var _main_div;

var _div_list = [];

echarts.registerTransform(ecSimpleTransform.aggregate);
echarts.registerTransform(ecStat.transform.histogram);

function reload(task, field, callback) {
	$.post('/reload', { task: task, field: field }, function (data) {
		if (data.error || data.code != 200) {
			alert("权限不足！");
			return;
		}
		callback();
	});
}

function removeChart(index) {
	_div_list[index].remove();
	_div_list.splice(index, 1);
}

function addPieChart() {
	var _chart_title = document.getElementById("chart-title");
	let chart = document.createElement("div");
	chart.id = (new Date()).getTime().toString(16);
	chart.classList.add("col-2");
	chart.style = "height: 400px";
	
	let option = document.getElementById("count_field");
	let field = option.options[option.selectedIndex].value;

	_main_div.appendChild(chart);
	_div_list.push(chart);

	reload("count", field, function() {
		$.post('/query', { task: "count", field: field, other_threshold: parseInt(document.getElementById("other_threshold").value) }, function (data) {
			if (data.error || data.code != 200) {
				chart.innerHTML = '<h2 class="center"> 权限不足 </h2>';
				return;
			}
			var pie_chart = echarts.init(chart, 'white', { renderer: 'canvas' });
			var pie_option = {
				title: {
					text: _chart_title.value,
					left: "center"
				},
				tooltip: {
					trigger: 'item'
				},
				legend: {
					top: '5%',
					orient: 'vertical',
					left: 'left',
					textStyle: {
						"fontSize": 8
					}
				},
				series: [
					{
						name: _chart_title.value,
						type: 'pie',
						radius: ['50%', '75%'],
						avoidLabelOverlap: false,
						label: {
							show: false,
							position: 'center',
							formatter: '{b}: {c}\n{d}%'
						},
						emphasis: {
							label: {
								show: true,
								fontSize: 24,
								fontWeight: 'bold'
							}
						},
						labelLine: {
							show: false
						},
						data: data["data"]
					}
				]
			};
			pie_chart.setOption(pie_option);
			console.log("Done with pie.");
		});
	});
}

function addBoxChart() {
	var _chart_title = document.getElementById("chart-title");
	let chart = document.createElement("div");
	chart.id = (new Date()).getTime().toString(16);
	chart.classList.add("col-2");
	chart.style = "height: 400px";
	
	let option = document.getElementById("raw_field");
	let field = option.options[option.selectedIndex].value;

	_main_div.appendChild(chart);
	_div_list.push(chart);
	
	$.post('/query', { task: "raw", field: field }, function (data) {
		if (data.error || data.code != 200) {
			chart.innerHTML = '<h2 class="center"> 权限不足 </h2>';
			return;
		}
		var box_chart = echarts.init(chart, 'white', { renderer: 'canvas' });
		var box_option = {
			title: {
				text: _chart_title.value,
				left: 'center'
			},
			dataset: [
				{
					id: 'raw',
					source: data["data"]
				},
				{
					id: 'aggregate',
					fromDatasetId: 'raw',
					transform: [
						{
							type: 'ecSimpleTransform:aggregate',
							config: {
								resultDimensions: [
									{ name: 'min', from: 'Score', method: 'min' },
									{ name: 'Q1', from: 'Score', method: 'Q1' },
									{ name: 'median', from: 'Score', method: 'median' },
									{ name: 'Q3', from: 'Score', method: 'Q3' },
									{ name: 'max', from: 'Score', method: 'max' },
									{ name: 'Metrics', from: 'Metrics' }
								],
								groupBy: 'Metrics'
							}
						},
						{
							type: 'sort',
							config: {
								dimension: 'Metrics',
								order: 'asc'
							}
						}
					]
				}
			],
			tooltip: {
				trigger: 'axis',
				confine: true
			},
			grid: {
				bottom: 100
			},
			xAxis: {
				name: 'Score',
				nameLocation: 'middle',
				nameGap: 30,
				scale: true
			},
			yAxis: {
				name: 'Metrics',
				type: 'category'
			},
			dataZoom: [
				{
					type: 'inside'
				},
				{
					type: 'slider',
					height: 20
				}
			],
			series: [
				{
					name: _chart_title.value,
					type: 'boxplot',
					datasetId: 'aggregate',
					encode: {
						x: ['min', 'Q1', 'median', 'Q3', 'max'],
						y: 'Metrics',
						itemName: ['Metrics'],
						tooltip: ['min', 'Q1', 'median', 'Q3', 'max']
					}
				}
			]
		};
		box_chart.setOption(box_option);
		console.log("Done with box.");
	});
}

function addLineChart() {
	var _chart_title = document.getElementById("chart-title");
	let chart = document.createElement("div");
	chart.id = (new Date()).getTime().toString(16);
	chart.classList.add("col-2");
	chart.style = "height: 400px";
	
	let option = document.getElementById("time_field");
	let field = option.options[option.selectedIndex].value;

	_main_div.appendChild(chart);
	_div_list.push(chart);

	reload("count", "date", function() {
		$.post('/query', { task: "count", field: "date" }, function (data) {
			if (data.error || data.code != 200) {
				chart.innerHTML = '<h2 class="center"> 权限不足 </h2>';
				return;
			}
			let raw_data = [];
			let min = 4096 * 12;
			let max = 0;
			let has_value = {};
			for (let i in data["data"]) {
				let tmp_v;
				let d = new Date(data["data"][i].name);
				let m = d.getMonth() + 1;
				if (field == "month") {
					tmp_v = d.getFullYear() * 12 + m - 1;
				} else {
					tmp_v = d.getFullYear();
				}
				
				if (tmp_v < min) {
					min = tmp_v;
				}
				if (tmp_v > max) {
					max = tmp_v;
				}
				if (field == "month") {
					has_value[tmp_v] = true;
					raw_data.push([d.getFullYear() + '/' + (m < 10 ? "0" + m : m), data["data"][i].value]);
				} else {
					has_value[tmp_v] = (has_value[tmp_v] || 0) + data["data"][i].value;
				}
			}
			if (field == "month") {
				for (let i = min + 1; i < max; ++i) {
					if (!has_value[i]) {
						let m = i % 12 + 1;
						raw_data.push([Math.floor(i / 12) + '/' + (m < 10 ? "0" + m : m), 0]);
					}
				}
			} else {
				for (let i = min; i <= max; ++i) {
					raw_data.push([i, has_value[i]]);
				}
			}
			
			raw_data.sort((a, b) => {
				if (a[0] == b[0]) return 0;
				if (a[0] < b[0]) return -1;
				return 1;
			});
			raw_data.unshift(['Date', 'Count']);
			var line_chart = echarts.init(chart, 'white', { renderer: 'canvas' });
			var line_option = {
				title: {
					text: _chart_title.value,
					left: "center"
				},
				tooltip: {
					trigger: 'axis'
				},
				xAxis: {
					type: 'category',
					nameLocation: 'middle'
				},
				yAxis: {
					name: 'Count'
				},
				dataZoom: [
					{
						type: 'inside'
					},
					{
						type: 'slider',
						height: 20
					}
				],
				series: [
					{
						name: _chart_title.value,
						type: 'line',
						smooth: true,
						data: raw_data,
						showSymbol: false,
						encode: {
							x: 'Date',
							y: 'Count',
							itemName: 'Date',
							tooltip: ['Count']
						}
					}
				]
			};
			line_chart.setOption(line_option);
			console.log("Done with line.");
		});
	});
}

function addHistChart() {
	var _chart_title = document.getElementById("chart-title");
	let chart = document.createElement("div");
	chart.id = (new Date()).getTime().toString(16);
	chart.classList.add("col-2");
	chart.style = "height: 400px";
	
	let option = document.getElementById("raw_field");
	let field = option.options[option.selectedIndex].value;

	_main_div.appendChild(chart);
	_div_list.push(chart);
	
	$.post('/query', { task: "raw", field: field }, function (data) {
		if (data.error || data.code != 200) {
			chart.innerHTML = '<h2 class="center"> 权限不足 </h2>';
			return;
		}
		data["data"].shift();
		var hist_chart = echarts.init(chart, 'white', { renderer: 'canvas' });
		var hist_option = {
			title: {
				text: _chart_title.value,
				left: 'center'
			},
			dataset: [
				{
					id: 'raw',
					source: data["data"]
				},
				{
					transform: {
						type: 'ecStat:histogram',
						config: {
							dimensions: [2]
						}
					}
				}
			],
			tooltip: {},
			xAxis: {
				name: "Score"
			},
			yAxis: {
				name: "频数"
			},
			series: [
				{
					name: _chart_title.value,
					type: 'bar',
					barWidth: '99%',
					label: {
						show: false,
						position: 'top'
					},
					encode: { x: 0, y: 1, itemName: 4 },
					datasetIndex: 1
				}
			]
		};
		hist_chart.setOption(hist_option);
		console.log("Done with hist.");
	});
}

function addCloudChart() {
	var _chart_title = document.getElementById("chart-title");
	let chart = document.createElement("div");
	chart.id = (new Date()).getTime().toString(16);
	chart.classList.add("col-2");
	chart.style = "height: 400px";
	
	let name_cb = document.getElementById("name-cb");
	let sponsor_cb = document.getElementById("sponsor-cb");
	let tester_cb = document.getElementById("tester-cb");
	let cpu_name_cb = document.getElementById("cpu_name-cb");
	let os_cb = document.getElementById("os-cb");
	let fields = ["fields"];
	if (name_cb.checked) {
		fields.push("name");
	}
	if (sponsor_cb.checked) {
		fields.push("sponsor");
	}
	if (tester_cb.checked) {
		fields.push("tester");
	}
	if (cpu_name_cb.checked) {
		fields.push("cpu_name");
	}
	if (os_cb.checked) {
		fields.push("os");
	}

	_main_div.appendChild(chart);
	_div_list.push(chart);
	
	$.post('/query', { task: "cloud", fields: fields }, function (data) {
		if (data.error || data.code != 200) {
			chart.innerHTML = '<h2 class="center"> 权限不足 </h2>';
			return;
		}
		console.log(data["data"]);
		var cloud_chart = echarts.init(chart, 'white', { renderer: 'canvas' });
		var cloud_option = {
			title: {
				text: _chart_title.value,
				left: 'center'
			},
			series: [{
				type: 'wordCloud',
				sizeRange: [15, 80],
				rotationRange: [0, 0],
				rotationStep: 45,
				gridSize: 8,
				shape: 'pentagon',
				width: '100%',
				height: '80%',
				textStyle: {
					normal: {
						color: function () {
							return 'rgb(' + [
								Math.round(Math.random() * 160),
								Math.round(Math.random() * 160),
								Math.round(Math.random() * 160)
							].join(',') + ')';
						},
						fontFamily: 'sans-serif',
						fontWeight: 'normal'
					},
					emphasis: {
						shadowBlur: 10,
						shadowColor: '#333'
					}
				},
				data: data["data"]
			}]
		};
		cloud_chart.setOption(cloud_option);
		console.log("Done with cloud.");
	});
}

function setMainDiv(div) {
	_main_div = div;
}