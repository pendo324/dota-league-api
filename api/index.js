const express = require('express');

const app = express.Router();

const logout = require('./logout');
const user = require('./user');
const lobbies = require('./lobbies');

app.use(logout);
app.use(user);
app.use(lobbies);

module.exports = app;
