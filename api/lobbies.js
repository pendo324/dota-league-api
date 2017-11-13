const express = require('express');
const db = require('../db');

const app = express.Router();
const io = require('./../server').io;

const uuid = require('uuid');

io.on('connection', (socket) => {
  socket.on('message', async (data) => {
    console.log(data);
  });

  socket.on('joinLobby', ({ lobbyId, userId }) => {
    console.log('test');
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
  
  socket.on('setTeam', async ({ userId, team, lobbyId }) => {
    const captain = await db.checkCaptain(socket.handshake.session.passport.user.id, team);
    if (captain) {
      const onTeam = await db.userOnTeam(userId);
      if (!onTeam) {
        await db.addToTeam(userId, team);
        io.in(`lobby_${lobbyId}`).emit('setTeam', {
          user: userId,
          team
        });
      }
    }
  });

  socket.on('joinQueue', async () => {
    db.addUserToQueue(socket.handshake.session.passport.user.id, socket.id);
    checkQueue();
  });

  socket.on('leaveQueue', async () => {
    db.removeUserFromQueue(socket.handshake.session.passport.user.id);
  });

  socket.on('acceptQueue', async (tempAcceptId) => {
    db.setAccepted(socket.handshake.session.passport.user.id, tempAcceptId);
    const accepted = await db.getAccepted().rows;
    if (accepted.length === 10) {
      // start picking teams
    }
  });

  socket.on('queueTimeout', async (queueId) => {
    // tell all clients to requeue
    // queueTimeout is sent when one is waiting too long (15s)
    // after the 'match ready' modal first appears
    // the users that do not respond to the modal will be
    // removed from the queue on the client side
    io.of(queueId).emit('queueTimeout');
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

app.post('/joinQueue', async (req, res) => {
  await db.addUserToQueue(req.user.id, req.body.socketId);
  checkQueue();
  res.sendStatus(200);
});
  
app.post('/leaveQueue', (req, res) => {
  db.removeUserFromQueue(req.user.id);
  res.sendStatus(200);
});
    
app.post('/acceptQueue', async (req, res) => {
  const { acceptQueueId } = req.body;
  console.log(acceptQueueId);
  await db.setAccepted(req.user.id, acceptQueueId);
  const accepted = await db.getAccepted(acceptQueueId);
  if (accepted.rowCount === 1) {
    // start picking teams
    // blast all sockets to join a newly created lobby
    const lobbyId = await db.createLobby();
    Object.keys(io.sockets.adapter.rooms[acceptQueueId].sockets).forEach((socketId) => {
      io.sockets.connected[socketId].join(`lobby_${lobbyId}`);
      io.sockets.connected[socketId].leave(acceptQueueId);

      io.in(`lobby_${lobbyId}`).emit('lobbyReady', { lobbyId });

      db.joinLobby(lobbyId, req.user.id).then(userResult =>
        io.in(`lobby_${lobbyId}`).emit('userJoined', {
          userId: userResult.rows[0].profile.id,
          displayName: userResult.rows[0].profile.displayName,
          avatar: userResult.rows[0].profile._json.avatar,
          lobbyId
        })).catch(console.log);
    });
  }

  res.sendStatus(200);
});
      
const checkQueue = async () => {
  const queue = await db.getQueue();
  setTimeout(() => {
    const nextAcceptQueue = queue.rows.slice(0, 10);
    const tempAcceptId = uuid();

    nextAcceptQueue.forEach((player) => {
      io.sockets.connected[player.socketid].join(tempAcceptId);
    });

    io.to(tempAcceptId).emit('acceptQueue', { acceptQueueId: tempAcceptId });
  }, 3000);
  /* if (queue.rows.length >= 10) {
    const nextAcceptQueue = queue.rows.slice(0, 10);
    const tempAcceptId = uuid();
    nextAcceptQueue.forEach((player) => {
      io.sockets.connected[player.socket].join(tempAcceptId);
    });

    io.of(tempAcceptId).emit('acceptQueue', { acceptQueueId: tempAcceptId });
  } */
}

module.exports = app;
