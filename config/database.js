// config/database.js
module.exports = {
    'connection': {
        'host': '173.194.110.202',
        'user': 'root',
        'password': 'rockwell01',
        'database': 'cloudconnect',
        'pool'    : {maxConnections:50, maxIdleTime:30}
    },
	'database': 'cloudconnect',
    'users_table': 'users'

};