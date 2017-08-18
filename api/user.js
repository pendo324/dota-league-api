const express = require('express');

const app = express.Router();

app.get('/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.sendStatus(401);
  }
});

module.exports = app;
