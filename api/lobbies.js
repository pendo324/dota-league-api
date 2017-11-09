const express = require('express');
const db = require('../db');

const app = express.Router();
const io = require('./../server').io;

io.on('connection', (socket) => {
  socket.on('message', (data) => {
    console.log(data);
  });

  socket.on('joinLobby', ({ lobbyId, userId }) => {
    socket.join(`lobby_${lobbyId}`);
    db.joinLobby(lobbyId, userId).then(userResult =>
      io.in(`lobby_${lobbyId}`).emit('userJoined', {
        userId: userResult.rows[0].profile.id,
        displayName: userResult.rows[0].profile.displayName,
        avatar: userResult.rows[0].profile._json.avatar
      })).catch(console.log);
  });

  socket.on('leaveLobby', ({ lobbyId, userId }) => {
    console.log(lobbyId, userId);
    socket.leave(`lobby_${lobbyId}`);
    db.leaveLobby(userId).then((userResult) => {
      io.in(`lobby_${lobbyId}`).emit('userLeft', {
        userId: userResult.rows[0].profile.id,
        displayName: userResult.rows[0].profile.displayName,
        avatar: userResult.rows[0].profile._json.avatar
      });
    });
  });

  socket.on('newMessage', ({ message, id }) => {
    db.newMessage(message, id, socket.handshake.session.passport.user.id).then((messageResult) => {
      io.in(`lobby_${id}`).emit('newMessage', {
        content: message,
        displayName: socket.handshake.session.passport.user.displayName,
        sent: messageResult.rows[0].sent
      });
      // socket.broadcast.to(`lobby_${id}`).emit('newMessage', { content: message, senderName: socket.handshake.session.passport.displayName });
    });
  });
});

app.get('/lobbies', (req, res) => {
  db.getLobbies().then((result) => {
    res.json(result.rows);
  });
});

app.get('/lobby/:id/messages', (req, res) => {
  db.getMessages(req.params.id).then((messageResult) => {
    const messages = messageResult.rows.map((message) => {
      return db.getUser(message.userid).then((userResult) => {
        message.displayName = userResult.rows[0].profile.displayName;
        return message;
      }).catch(err => {
        console.log(err);
      });
    });
    Promise.all(messages).then(ms => res.json(ms));
  }).catch(err => {
    console.log(err);
  });
});

app.get('/lobby/:id', (req, res) => {
  const messages = db.getMessages(req.params.id).then((messageResult) => {
    return Promise.all(messageResult.rows.map((message) => {
      return db.getUser(message.userid).then((userResult) => {
        message.displayName = userResult.rows[0].profile.displayName;
        return message;
      }).catch(err => {
        console.log(err);
      });
    }));
  }).catch(err => {
    console.log(err);
  });
  const members = db.getLobbyMembers(req.params.id).then((memberResult) => {
    return memberResult.rows.map(row => ({
      userId: row.profile.id,
      displayName: row.profile.displayName,
      avatar: row.profile._json.avatar
    }));
  }).catch(err => console.log(err));


  Promise.all([messages, members]).then(([messages, members]) => {
    res.json({
      members,
      messages,
      lobbyId: req.params.id
    });
    //ret.lobbyId = req.params.id;
    //console.log(ret);
    //res.json(ret);
  }).catch(err => console.log(err));
});

module.exports = app;
