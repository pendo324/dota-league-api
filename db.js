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

module.exports.getUser = identifier => pool.query('select * from dotaleague.user where identifier = $1', [identifier]);

module.exports.createUser = (identifier, profile) => pool.query('insert into dotaleague.user (identifier, profile) values ($1, $2)', [identifier, profile]);

module.exports.setProfile = (identifier, profile) => pool.query('update dotaleague.user set profile = $1 where identifier = $2', [profile, identifier]);

module.exports.getLobbies = () => pool.query('select * from dotaleague.lobby');

module.exports.newMessage = (message, lobby, userId) => pool.query('insert into dotaleague.messages (content, lobbyid, userId) values ($1, $2, $3) returning *', [message, lobby, userId]);

module.exports.getMessages = lobbyId => pool.query('select * from dotaleague.messages where messages.lobbyid = $1', [lobbyId]);

module.exports.getLobbyMembers = lobbyId => pool.query('select * from dotaleague.user where lobbyid = $1', [lobbyId]);

module.exports.joinLobby = (lobbyId, userId) => pool.query('update dotaleague.user set lobbyid = $1 where identifier = $2 returning *', [lobbyId, userId]);

module.exports.leaveLobby = userId => pool.query('update dotaleague.user set lobbyid = null where identifier = $1 returning *', [userId]);

module.exports.pg = pool.client;

module.exports.pool = pool;

