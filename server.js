const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo.listen(server);

module.exports = {
  io,
  server,
  app
};
