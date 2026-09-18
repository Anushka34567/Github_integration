const mongoose = require('mongoose');

// Constructed URI from config logic
const user = encodeURIComponent('31aryanagivale_db_user');
const pass = 'Aryan@1708';
const server = 'trudesk.xjzj78s.mongodb.net';
const dbName = 'trudesk';

const uri = `mongodb+srv://${user}:${pass}@${server}/${dbName}?appName=trudesk`;

console.log('Testing connection to:', uri.replace(pass, '****'));

mongoose.connect(uri)
    .then(() => {
        console.log('Connected successfully!');
        process.exit(0);
    })
    .catch(err => {
        console.error('Connection failed:', err);
        process.exit(1);
    });
