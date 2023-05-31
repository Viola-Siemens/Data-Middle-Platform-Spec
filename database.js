'use strict';

const config = {
    user: "root",
    host: 'localhost',
    database: "Spec",
    password: "123456",
    port: 5432
}

const pg = require('pg');
const client = new pg.Client(config);

module.exports.connect = function () {
    client.connect(function (err, client, done) {
        if (err) {
            console.error(err);
        } else {
            console.log("Database Connected Successfully!");
        }
    });
};

module.exports.query = function (sql, values, callback) {
    client.query(sql, values, function (err, result) {
        if (err) {
            callback(err);
        } else {
            if (result.rows != undefined) {
                callback(null, result.rows);
            } else {
                callback(null);
            }
        }
    });
};