const Pool = require('pg-pool');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  ssl: false
};

const pool = new Pool(config);

module.exports.query = (text, values) => pool.query(text, values);

module.exports.getUser = identifier =>
  pool.query('select * from dotaleague.user where identifier = $1', [identifier]);

module.exports.createUser = (identifier, profile) =>
  pool.query('insert into dotaleague.user (identifier, profile) values ($1, $2)', [
    identifier,
    profile
  ]);

module.exports.setProfile = (identifier, profile) =>
  pool.query('update dotaleague.user set profile = $1 where identifier = $2', [
    profile,
    identifier
  ]);

module.exports.getLobbies = () => pool.query('select * from dotaleague.lobby');

module.exports.newMessage = (message, lobby, userId) =>
  pool.query(
    'insert into dotaleague.messages (content, lobbyid, userId) values ($1, $2, $3) returning *',
    [message, lobby, userId]
  );

module.exports.getMessages = lobbyId =>
  pool.query('select * from dotaleague.messages where messages.lobbyid = $1', [lobbyId]);

module.exports.getLobbyMembers = lobbyId =>
  pool.query('select * from dotaleague.user where lobbyid = $1', [lobbyId]);

module.exports.createLobby = () =>
  pool
    .query("insert into dotaleague.lobby (started, name) values (FALSE, 'test') returning id")
    .then((result) => {
      return result.rows[0].id
    });

module.exports.joinLobby = (lobbyId, userId) =>
  pool.query('update dotaleague.user set lobbyid = $1 where identifier = $2 returning *', [
    lobbyId,
    userId
  ]);

module.exports.leaveLobby = userId =>
  pool.query('update dotaleague.user set lobbyid = null where identifier = $1 returning *', [
    userId
  ]);

module.exports.checkCaptain = (userId, team) =>
  pool
    .query(
      `select * from dotaleague.user
      join dotaleague.lobby on lobby.id = dotaleague.user.lobbyid
      where identifier = $1`,
      [userId]
    )
    .then((result) => {
      if (result.length === 1) {
        const user = result[0];
        if (user[`${team}_captain`] === userId) {
          return true;
        }
      } else {
        return false;
      }
    });

module.exports.userOnTeam = userId =>
  pool
    .query(
      `select * from dotaleague.user
    where identifier = $1`,
      [userId]
    )
    .then((result) => {
      if (result.length === 1) {
        const user = result[0];
        if (user.team !== null) {
          return true;
        }
        return false;
      }
      return false;
    });

module.exports.getQueue = () => pool.query('select * from dotaleague.queue');

module.exports.addUserToQueue = (userId, socketId) =>
  pool.query('insert into dotaleague.queue (userId, socketId) values($1, $2)', [userId, socketId]);

module.exports.setAccepted = (userId, tempAcceptId) =>
  pool.query('update dotaleague.queue set(accepted, acceptId) = (TRUE, $2) where userId = $1', [
    userId,
    tempAcceptId
  ]);

module.exports.getAccepted = tempAcceptId =>
  pool.query('select * from dotaleague.queue where accepted = TRUE and acceptId = $1', [tempAcceptId]);

module.exports.removeUserFromQueue = userId =>
  pool.query('delete from dotaleague.queue where userId = $1', [userId]);

module.exports.pg = pool.client;

module.exports.pool = pool;
