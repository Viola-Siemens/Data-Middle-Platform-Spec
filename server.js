'use strict';

const express = require("express");
const cookieParser = require("cookie-parser");
const http = require("http");
const https = require("https");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const cheerio = require("cheerio");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const database = require("./database.js");

database.connect();

var server = express();
server.use(express.static('public'));
server.use(cors());
server.use(express.json());
server.use(bodyParser.json());
server.use(bodyParser.urlencoded({ extended: false }));
server.use(cookieParser("俺は、人間を辞めるぞ、ジョジョ！"));

var upload = multer({ dest: 'public/uploads/' });
const maxAge = 2*60*60*1000;
const httpport = process.env.PORT || 1337;
const httpsport = 443;

var active_users = {};
const permission_levels = [
	"用户",
	"高级用户",
	"管理员",
	"超级管理员"
];

let main = function (req, res) {
	res.writeHead(200, { 'Content-type': 'text/html; charset=utf-8' });

	let $ = cheerio.load(fs.readFileSync("html/index.html"));

	let uid = req.cookies.id;
	let token = req.cookies.token;
	let username = "游客";
	let permission = "";

	if (uid in active_users && active_users[uid].token == token) {
		username = active_users[uid].username;
		permission = permission_levels[active_users[uid].permission];
		$('a[href="/login"]').attr("hidden", "hidden");
		$('a[href="/signup"]').attr("hidden", "hidden");
		$('a[href="/logout"]').removeAttr("hidden");
	}

	$('span#welcome-permission').text(permission);
	$('span#welcome-username').text(username);
		
	res.end($.html());
};

server.get('/', main);
server.get('/index', main);

function addStrSql(sql, cnt, field) {
	if (cnt == 1) {
		sql += " WHERE";
	} else {
		sql += " AND";
	}
	sql += " " + field + ` LIKE \$${cnt}`;
	return sql;
}

function addNumberSql(sql, cnt, field, cond) {
	if (cnt == 1) {
		sql += " WHERE";
	} else {
		sql += " AND";
	}
	sql += " " + field + ` ${cond} \$${cnt}`;
	return sql;
}

function getCond(s) {
	switch (s) {
		case "gt":
			return ">";
			break;
		case "lt":
			return "<";
			break;
		case "ge":
			return ">=";
			break;
		case "le":
			return "<=";
			break;
	}
	return "=";
}

function fromCond(s) {
	switch (s) {
		case ">":
			return "gt";
			break;
		case "<":
			return "lt";
			break;
		case ">=":
			return "ge";
			break;
		case "<=":
			return "le";
			break;
	}
	return "eq";
}

function parse(q) {
	let ret = { cnt: 0, sql: "", params: [], other_get_params: "vanilla=true" };
	if (q.name) {
		ret.cnt += 1;
		ret.sql = addStrSql(ret.sql, ret.cnt, "name");
		ret.params.push("%"+q.name+"%");
		ret.other_get_params += `&name=${q.name}`;
	}
	if (q.sponsor) {
		ret.cnt += 1;
		ret.sql = addStrSql(ret.sql, ret.cnt, "sponsor");
		ret.params.push("%"+q.sponsor+"%");
		ret.other_get_params += `&sponsor=${q.sponsor}`;
	}
	if (q.tester) {
		ret.cnt += 1;
		ret.sql = addStrSql(ret.sql, ret.cnt, "tester");
		ret.params.push("%"+q.tester+"%");
		ret.other_get_params += `&tester=${q.tester}`;
	}
	if (q.date) {
		ret.cnt += 1;
		ret.sql = addStrSql(ret.sql, ret.cnt, "date");
		ret.params.push("%"+q.date+"%");
		ret.other_get_params += `&date=${q.date}`;
	}
	if (q.cpu_name) {
		ret.cnt += 1;
		ret.sql = addStrSql(ret.sql, ret.cnt, "cpu_name");
		ret.params.push("%"+q.cpu_name+"%");
		ret.other_get_params += `&cpu_name=${q.cpu_name}`;
	}
	if (q.max_mhz) {
		ret.cnt += 1;
		let cond = getCond(q.cond_max_mhz);
		ret.sql = addNumberSql(ret.sql, ret.cnt, "max_mhz", cond);
		ret.params.push(q.max_mhz);
		ret.other_get_params += `&max_mhz=${q.max_mhz}&cond_max_mhz=${fromCond(cond)}`;
	}
	if (q.nominal) {
		ret.cnt += 1;
		let cond = getCond(q.cond_nominal);
		ret.sql = addNumberSql(ret.sql, ret.cnt, "nominal", cond);
		ret.params.push(q.nominal);
		ret.other_get_params += `&nominal=${q.nominal}&cond_nominal=${fromCond(cond)}`;
	}
	if (q.os) {
		ret.cnt += 1;
		ret.sql = addStrSql(ret.sql, ret.cnt, "os");
		ret.params.push("%"+q.os+"%");
		ret.other_get_params += `&os=${q.os}`;
	}
	if (q.filesystem) {
		ret.cnt += 1;
		ret.sql = addStrSql(ret.sql, ret.cnt, "filesystem");
		ret.params.push("%"+q.filesystem+"%");
		ret.other_get_params += `&filesystem=${q.filesystem}`;
	}
	return ret;
}

server.get('/content', function (req, res) {
	res.writeHead(200, { 'Content-type': 'text/html; charset=utf-8' });

	let $ = cheerio.load(fs.readFileSync("html/content.html"));

	let uid = req.cookies.id;
	let token = req.cookies.token;
	let username = "游客";
	let permission = "";

	if (uid in active_users && active_users[uid].token == token) {
		username = active_users[uid].username;
		permission = permission_levels[active_users[uid].permission];
		$('span#welcome-permission').text(permission);
		$('span#welcome-username').text(username);
	} else {
		$('h2#caption').text('登录后查看更多');
		res.end($.html());
		return;
	}


	let query_obj = parse(req.query);
	let page = req.query.page || 1;
	if (!(page instanceof Number)) {
		try {
			page = parseInt(page);
		} catch (e) {
			page = 1;
		}
	}
	let offset = (page - 1) * 100;
	let query_sql = "SELECT * FROM systems" + query_obj.sql + ` LIMIT 100 OFFSET ${offset};`;
	//console.log(query_sql);

	database.query(query_sql, query_obj.params, function (qerr, result) {
		if (qerr) {
			console.error(qerr);
			res.end(`<script>alert("数据库查询失败，请稍后重试！");window.location.replace("/");</script>`);
			return;
		}
		let result_html = "";
		for (let i in result) {
			result_html += `
<tr>
    <td><a href="/detail?id=${result[i].id}">${result[i].name}</a></td>
	<td>${result[i].sponsor}</td>
    <td>${result[i].tester}</td>
    <td>${result[i].date}</td>
</tr>
`
		}
		$("tbody#table-body").append(result_html);
		let cnt_sql = "SELECT COUNT(*) AS cnt FROM systems" + query_obj.sql + ";";
		//console.log(cnt_sql);
		database.query(cnt_sql, query_obj.params, function (qerr1, result1) {
			if (qerr1) {
				console.error(qerr1);
				res.end(`<script>alert("数据库查询失败，请稍后重试！");window.location.replace("/");</script>`);
				return;
			}
			let jump_html = `
<a href="/content?page=${1}&${query_obj.other_get_params}" class="btn-alt small shadow" style="background-color: ${1 == page ? "forestgreen" : "darkgreen"}">首页</a>
`;
			let max_page = Math.ceil((result1[0].cnt || 1000) / 100);
			for (let p = Math.max(page - 3, 1); p <= page + 3; ++p) {
				if (p > max_page) {
					break;
				}
				jump_html += `
<a href="/content?page=${p}&${query_obj.other_get_params}" class="btn-alt small shadow" style="background-color: ${p == page ? "forestgreen" : "darkgreen"}">${p}</a>
`;
			}
			jump_html += `
<a href="/content?page=${max_page}&${query_obj.other_get_params}" class="btn-alt small shadow" style="background-color: ${max_page == page ? "forestgreen" : "darkgreen"}">尾页</a>
`;
			$('caption#jump-btns').append(jump_html);
			res.end($.html());
		});
	});
});

server.get('/detail', function (req, res) {
	res.writeHead(200, { 'Content-type': 'text/html; charset=utf-8' });

	let $ = cheerio.load(fs.readFileSync("html/detail.html"));

	let uid = req.cookies.id;
	let token = req.cookies.token;
	let sid = req.query.id;

	if (uid in active_users && active_users[uid].token == token) {
		database.query('SELECT * FROM systems WHERE id = $1;', [sid], function (qerr, result) {
			if (qerr) {
				console.error(qerr);
				res.end(`<script>alert("数据库查询失败，请稍后重试！");window.location.replace("/");</script>`);
				return;
			}
			if (!result || result.length == 0) {
				res.end(`<script>alert("非法的请求！");window.location.replace("/");</script>`);
				return;
			}
			for (let m of ["cpu_name", "max_mhz", "nominal", "enabled", "orderable", "cache_l1", "cache_l2", "cache_l3", "memory", "storage", "os", "compiler", "parallel", "firmware", "filesystem", "state", "base_pointer", "peak_pointer"]) {
				$(`td#${m}`).text(result[0][m]);
			}
			res.end($.html());
		});
	} else {
		$('h2#caption').text('登录后查看更多');
		res.end($.html());
	}
});

server.get('/about', function (req, res) {
	res.writeHead(200, { 'Content-type': 'text/html; charset=utf-8' });

	let $ = cheerio.load(fs.readFileSync("html/about.html"));

	let uid = req.cookies.id;
	let token = req.cookies.token;
	let username = "游客";
	let permission = "";

	if (uid in active_users && active_users[uid].token == token) {
		username = active_users[uid].username;
		permission = permission_levels[active_users[uid].permission];
	}

	$('span#welcome-permission').text(permission);
	$('span#welcome-username').text(username);
		
	res.end($.html());
});

server.get('/login', function (req, res) {
	res.writeHead(200, { 'Content-type': 'text/html; charset=utf-8' });

	res.end(fs.readFileSync("html/login.html"));
});

server.post('/login', function (req, res) {
	database.query('SELECT * FROM users WHERE username = $1 AND password = $2;', [req.body.username, req.body.password], function (qerr, result) {
		if(qerr) {
			console.error(qerr);
			res.writeHead(200, { 'Content-type': 'text/html; charset=utf-8' });
			res.end(`<script>alert("数据库查询失败，请稍后重试！");window.location.replace("/login");</script>`);
			return;
		}
		if (!result || result.length == 0) {
			res.writeHead(200, { 'Content-type': 'text/html; charset=utf-8' });
			res.end(`<script type="text/javascript">alert("登录失败！用户名或密码错误。");window.location.replace("/");</script>`);
			return;
		}
		let id = result[0].id;
		let time = (new Date()).getTime();
		let salt = Math.floor(Math.random() * 65536);
		let token = crypto.createHash("sha256").update(result[0].username + (time ^ salt)).digest("hex");
		res.cookie("id", id, { maxAge: maxAge });
		res.cookie("token", token, { maxAge: maxAge });
		active_users[id] = {
			username: result[0].username,
			permission: result[0].permission,
			time: time,
			salt: salt,
			token: token
		};
		res.writeHead(200, { 'Content-type': 'text/html; charset=utf-8' });
		res.end(`<script type="text/javascript">alert("欢迎${permission_levels[result[0].permission]}-${result[0].username}-登录！");window.location.replace("/");</script>`);
		database.query('INSERT INTO user_actions (user_id, action, time) VALUES ($1, $2, to_timestamp($3));', [id, "login", time / 1000], function (qerr1, result1) {
			if(qerr1) {
				console.error(qerr1);
				return;
			}
		});
	});
});

server.get('/logout', function (req, res) {
	res.writeHead(200, { 'Content-type': 'text/html; charset=utf-8' });
	let uid = req.cookies.id;
	let token = req.cookies.token;
	let time = (new Date()).getTime();
	
	if (uid in active_users && active_users[uid].token == token) {
		delete active_users[uid];
		database.query('INSERT INTO user_actions (user_id, action, time) VALUES ($1, $2, to_timestamp($3));', [uid, "logout", time / 1000], function (qerr, result) {
			if(qerr) {
				console.error(qerr);
				res.end(`<script>alert("数据库插入失败，请稍后重试！");window.location.replace("/");</script>`);
				return;
			}
			res.end(`<script>alert("登出成功！");window.location.replace("/");</script>`);
		});
	} else {
		res.end(`<script>alert("您已经登出，无需重复操作！");window.location.replace("/");</script>`);
	}
});

server.get('/signup', function (req, res) {
	res.writeHead(200, { 'Content-type': 'text/html; charset=utf-8' });

	res.end(fs.readFileSync("html/signup.html"));
});

server.post('/signup', function (req, res) {
	res.writeHead(200, { 'Content-type': 'text/html; charset=utf-8' });

	if (req.body.password != req.body.password2) {
		res.end(`<script type="text/javascript">alert("两次输入的密码不同！请检查是否有误。");window.location.replace("/");</script>`);
		return;
	}

	database.query('SELECT * FROM users WHERE username = $1;', [req.body.username], function (qerr, result) {
		if(qerr) {
			console.error(qerr);
			res.end(`<script>alert("数据库查询失败，请稍后重试！");window.location.replace("/signup");</script>`);
			return;
		}
		if (result && result.length > 0) {
			res.end(`<script type="text/javascript">alert("注册失败！该用户名已被注册。");window.location.replace("/");</script>`);
			return;
		}
		database.query('INSERT INTO users (username, password) VALUES ($1, $2);', [req.body.username, req.body.password], function(qerr1, result1) {
			if (qerr1) {
				console.error(qerr1);
				res.end(`<script>alert("数据库插入失败，请稍后重试！");window.location.replace("/signup");</script>`);
				return;
			}
			res.end(`<script>alert("注册成功！请您登录浏览。");window.location.replace("/login");</script>`);
		});
	});
});

let stat_types = {
	"min": function (rows, table, field, outer, callback) {
		let ret = rows[0][field];
		for (let i in rows) {
			if(ret > rows[i][field]) {
				ret = rows[i][field];
			}
		}
		callback(ret);
	},
	"max": function (rows, table, field, outer, callback) {
		let ret = rows[0][field];
		for (let i in rows) {
			if(ret < rows[i][field]) {
				ret = rows[i][field];
			}
		}
		callback(ret);
	},
	"sum": function (rows, table, field, outer, callback) {
		let ret = 0;
		for (let i in rows) {
			ret += rows[i][field];
		}
		callback(ret);
	},
	"average": function (rows, table, field, outer, callback) {
		outer("sum", rows, table, field, function(v) {
			callback(v / rows.length);
		});
	},
	"variance": function (rows, table, field, outer, callback) {
		outer("average", rows, table, field, function(mean) {
			let ret = 0;
			for (let i in rows) {
				let d = (rows[i][field] - mean);
				ret += d * d;
			}
			callback(ret / (rows.length - 1));
		});
	},
	"standard_deviation": function (rows, table, field, outer, callback) {
		outer("variance", rows, table, field, function(v) {
			callback(Math.sqrt(v));
		});
	}
}

function compute_if_absent(type, rows, table, field, callback) {
	database.query('SELECT * FROM stats WHERE field = $1 AND type = $2;', [table + '.' + field, type], function(qerr, result) {
		if(qerr) {
			console.error(qerr);
			callback(NaN);
			return;
		}
		if (!result || result.length == 0) {
			stat_types[type](rows, table, field, compute_if_absent, callback);
		} else {
			callback(result[0].v)
		}
	});
}

server.get("/main", function (req, res) {
	res.writeHead(200, { 'Content-type': 'text/html; charset=utf-8' });

	let $ = cheerio.load(fs.readFileSync("html/main.html"));

	let uid = req.cookies.id;
	let token = req.cookies.token;
	let username = "游客";
	let permission = -1;

	if (uid in active_users && active_users[uid].token == token) {
		username = active_users[uid].username;
		permission = active_users[uid].permission;
	}

	$('span#welcome-permission').text(permission_levels[permission]);
	$('span#welcome-username').text(username);
	if (permission < 2) {
		$('.visible-permission-above-2').attr("hidden", "hidden");
	}
	
	res.end($.html());
});

function checkPermissionOrElse(uid, token, level, callback, fallback) {
	if (uid in active_users && active_users[uid].token == token && active_users[uid].permission >= level) {
		callback();
	} else {
		fallback();
	}
}

server.post("/query", function (req, res) {
	let uid = req.cookies.id;
	let token = req.cookies.token;

	checkPermissionOrElse(uid, token, 0, () => {
		switch (req.body.task) {
			case "count":
				switch (req.body.field) {
					case "sponsor":
						let other_threshold = req.body.other_threshold || 0;
						if (other_threshold instanceof String) {
							try {
								other_threshold = parseInt(other_threshold);
							} catch (e) {
								other_threshold = 0;
							}
						}
						database.query("SELECT * FROM counts WHERE field = $1;", ["systems.sponsor"], function (qerr, result) {
							if (qerr) {
								console.error(qerr);
								res.json({error: `Database error - ${qerr}!`, code: 1410});
								return;
							}
							if (result && result.length > 0) {
								let data = [];
								let other = { name: "Others", value: 0 };
								for (let i in result) {
									if(result[i].v >= other_threshold) {
										data.push({ name: result[i].name, value: result[i].v });
									} else {
										other.value += result[i].v;
									}
								}
								data.push(other);
								res.json({ code: 200, data: data });
							} else {
								res.json({ code: 200, data: [] });
							}
						});
						break;
					case "date":
						database.query("SELECT * FROM counts WHERE field = $1;", ["systems.date"], function (qerr, result) {
							if (qerr) {
								console.error(qerr);
								res.json({error: `Database error - ${qerr}!`, code: 1410});
								return;
							}
							if (result && result.length > 0) {
								let data = [];
								for (let i in result) {
									data.push({ name: result[i].name, value: result[i].v });
								}
								res.json({ code: 200, data: data });
							} else {
								res.json({ code: 200, data: [] });
							}
						});
						break;
					default:
						res.json({error: `No field named "${req.body.field}"!`, code: 1402});
						break;
				}
				break;
			case "raw":
				switch (req.body.field) {
					case "metric_score":
						database.query("SELECT * FROM metrics;", [], function (qerr, result) {
							if (qerr) {
								console.error(qerr);
								res.json({error: `Database error - ${qerr}!`, code: 1410});
								return;
							}
							if (result && result.length > 0) {
								let data = [];
								data.push(["Metrics", "Score"]);
								for (let i in result) {
									data.push([result[i].metrics, result[i].base]);
								}
								res.json({ code: 200, data: data });
							} else {
								res.json({ code: 200, data: [] });
							}
						});
						break;
					case "max_mhz":
						database.query("SELECT name, max_mhz FROM systems;", [], function (qerr, result) {
							if (qerr) {
								console.error(qerr);
								res.json({error: `Database error - ${qerr}!`, code: 1410});
								return;
							}
							if (result && result.length > 0) {
								let data = [];
								data.push(["Name", "Max_MHz"]);
								for (let i in result) {
									data.push([result[i].name, result[i].max_mhz]);
								}
								res.json({ code: 200, data: data });
							} else {
								res.json({ code: 200, data: [] });
							}
						});
						break;
					default:
						res.json({error: `No field named "${req.body.field}"!`, code: 1402});
						break;
				}
				break;
			default:
				res.json({error: `No task named "${req.body.task}"!`, code: 1401});
				break;
		}
	}, () => {
		res.json({error: `Permission level not reached!`, code: 1400});
	});
});
server.post("/reload", function (req, res) {
	let uid = req.cookies.id;
	let token = req.cookies.token;

	checkPermissionOrElse(uid, token, 2, () => {
		switch (req.body.task) {
			case "count":
				switch (req.body.field) {
					case "sponsor":
						database.query("SELECT sponsor, COUNT(*) AS cnt FROM systems GROUP BY sponsor;", [], function (qerr, result) {
							if (qerr) {
								console.error(qerr);
								res.json({error: `Database error when selecting - ${qerr}!`, code: 1410});
								return;
							}
							if (result && result.length > 0) {
								database.query("DELETE FROM counts WHERE field = $1;", ["systems.sponsor"], function (qerr1, result1) {
									if (qerr1) {
										console.error(qerr1);
										res.json({error: `Database error when deleting - ${qerr1}!`, code: 1410});
										return;
									}
									let i = 0;
									let to_insert = function (ind) {
										if (ind >= result.length) {
											res.json({ code: 200 });
											return;
										}
										database.query("INSERT INTO counts (field, name, v) VALUES($1, $2, $3);", ["systems.sponsor", result[ind].sponsor, result[ind].cnt], function(qerr2, result2) {
											if (qerr2) {
												console.error(qerr2);
												res.json({error: `Database error when inserting - ${qerr2}!`, code: 1410});
												return;
											}
											to_insert(ind + 1);
										});
									}
									to_insert(i);
								});
							} else {
								res.json({ code: 1501, error: "Broken Table!" });
							}
						});
						break;
					case "date":
						database.query("SELECT date, COUNT(*) AS cnt FROM systems GROUP BY date;", [], function (qerr, result) {
							if (qerr) {
								console.error(qerr);
								res.json({error: `Database error when selecting - ${qerr}!`, code: 1410});
								return;
							}
							if (result && result.length > 0) {
								database.query("DELETE FROM counts WHERE field = $1;", ["systems.date"], function (qerr1, result1) {
									if (qerr1) {
										console.error(qerr1);
										res.json({error: `Database error when deleting - ${qerr1}!`, code: 1410});
										return;
									}
									let i = 0;
									let to_insert = function (ind) {
										if (ind >= result.length) {
											res.json({ code: 200 });
											return;
										}
										database.query("INSERT INTO counts (field, name, v) VALUES($1, $2, $3);", ["systems.date", result[ind].date, result[ind].cnt], function(qerr2, result2) {
											if (qerr2) {
												console.error(qerr2);
												res.json({error: `Database error when inserting - ${qerr2}!`, code: 1410});
												return;
											}
											to_insert(ind + 1);
										});
									}
									to_insert(i);
								});
							} else {
								res.json({ code: 1501, error: "Broken Table!" });
							}
						});
						break;
					default:
						res.json({error: `No field named "${req.body.field}"!`, code: 1402});
						break;
				}
				break;
			case "raw":
				switch (req.body.field) {
					case "metric_score":
						res.json({ code: 200 });
						break;
					case "max_mhz":
						res.json({ code: 200 });
						break;
					default:
						res.json({error: `No field named "${req.body.field}"!`, code: 1402});
						break;
				}
				break;
			case "stat":
				switch (req.body.field) {
					default:
						res.json({error: `No field named "${req.body.field}"!`, code: 1402});
						break;
				}
				break;
			default:
				res.json({error: `No task named "${req.body.task}"!`, code: 1401});
				break;
		}
	}, () => {
		res.json({error: `Permission level not reached!`, code: 1400});
	});
});


setInterval(function () {
	let now_time = (new Date()).getTime();
	for (let i in active_users) {
		if (active_users[i].time + maxAge < now_time) {
			delete active_users[i];
		}
	}
}, 30 * 1000);


http.createServer(server).listen(httpport);
