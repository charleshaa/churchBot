const sql = require('sqlite3').verbose();

module.exports = function(dbName){
    var dis = this;

    this.fileName = dbName;
    var db; 
    
    this.init = () => {
        db = new sql.Database(this.fileName + '.sqlite3', createTagsTable);
    };

    function validateTag(tag){
        return tag.indexOf(' ') < 0 || tag.indexOf('#') < 0;
    }

    function insertTag(tag, cb){
        if(!validateTag(tag)) return false;
        const stmt = `INSERT INTO tags(tag) VALUES('${tag}');`;
        return db.run(stmt, function(){
            console.info(`Inserted tag #${tag} with ID ${this.lastID}`);
            if (cb) cb();
        });
    }

    function createTagsTable(){
        const stmt = `CREATE TABLE IF NOT EXISTS hashtags (
            id INTEGER PRIMARY KEY,
            tag TEXT, 
            like_count INTEGER DEFAULT (0),
            blocked BOOLEAN,
            last_used TIMESTAMP DEFAULT (strftime('%s', 'now')),
            times_used INTEGER DEFAULT (0)
        );`;
        db.run(stmt, createLikesTable);
    };

    function createLikesTable(){
        const stmt = `CREATE TABLE IF NOT EXISTS likes (
                        id INTEGER PRIMARY KEY,
                        session_id INTEGER,
                        ig_id TEXT, 
                        success BOOLEAN, 
                        time TIMESTAMP DEFAULT (strftime('%s', 'now')),
                        media INTEGER
                    )`;
        db.run(stmt, createMediaTable);
    };
    
    function createMediaTable(){
        const stmt = `CREATE TABLE IF NOT EXISTS media (
                        id INTEGER PRIMARY KEY,
                        ig_id TEXT, 
                        like_id,
                        media_type INTEGER, 
                        taken_at TIMESTAMP,
                        author_username TEXT,
                        author_displayname TEXT,
                        author_avatar TEXT,
                        caption TEXT,
                        web_link TEXT,
                        was_liked BOOLEAN,
                        flag BOOLEAN  
                    )`;
        db.run(stmt, createSessionsTable);
    };

    function createSessionsTable(){
        const stmt = `CREATE TABLE IF NOT EXISTS sessions (
                        id INTEGER PRIMARY KEY,
                        tags TEXT,
                        tag_count INTEGER DEFAULT (0),
                        like_attempts INTEGER DEFAULT (0),
                        like_success INTEGER DEFAULT (0), 
                        start_time TIMESTAMP DEFAULT (strftime('%s', 'now')),
                        end_time TIMESTAMP,
                        flags_count INTEGER DEFAULT (0)
                    )`;
        db.run(stmt, createStratsTable);
    };

    function createStratsTable(){
        const stmt = `CREATE TABLE IF NOT EXISTS strats (
                        id INTEGER PRIMARY KEY,
                        tags TEXT,
                        like_attempts INTEGER DEFAULT (0),
                        like_success INTEGER DEFAULT (0), 
                        last_used TIMESTAMP DEFAULT (strftime('%s', 'now')),
                        times_used INTEGER DEFAULT (0),
                        flags_count INTEGER DEFAULT (0)
                    )`;
        db.run(stmt, () => console.log('Finished initialising database'));
    };
    
};