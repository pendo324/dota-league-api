const express = require('express');

const app = express.Router();

app.get('/logout', (req, res) => {
  console.log('test');
  req.logout();
  res.redirect('/');
});

module.exports = app;
