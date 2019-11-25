const sql = require('sqlite3').verbose();

module.exports = function (dbName) {
    var dis = this;

    this.fileName = dbName;
    var db;

    this.init = () => {
        db = new sql.Database(this.fileName + '.sqlite3', createTagsTable);
        db.on('trace', function (stmt) {
            console.info('\r\n---\r\nExecuted query: \r\n' + stmt + '\r\n---');
        });
    };

    function validateTag(tag) {
        return tag.indexOf(' ') < 0 || tag.indexOf('#') < 0;
    }

    this.insertMedia = (media, cb) => {
        const stmt = `INSERT INTO media(
                                    ig_id, 
                                    media_type, 
                                    taken_at, 
                                    author_username, 
                                    author_displayname, 
                                    author_avatar, 
                                    caption,
                                    web_link,
                                    photo_url
                                ) VALUES(
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?
                                );`;
        return db.run(stmt, [
                media.id,
                media.mediaType,
                media.takenAt,
                media.user.username,
                media.user.full_name,
                media.user.profile_pic_url,
                media.caption,
                media.webLink,
                media.images[0].url
            ],
            function (err) {
                if (err) {
                    console.log('ERROR !');
                    console.error(err);
                } else {
                    if (cb) cb(this.lastID);
                }

            });
    }

    this.getTag = (id, cb) => {
        const stmt = `SELECT * FROM hashtags WHERE id = ${id}`;
        let data = [];
        db.each(stmt, function (err, row) {
            data.push(row);
        }, function () {
            if (cb) cb(data);
        });
    }

    this.getTagBySlug = (tag, cb) => {
        const stmt = `SELECT * FROM hashtags WHERE tag = '${tag}'`;
        console.log('Should get tag with query: ', stmt);
        let data = [];
        db.each(stmt, function (err, row) {
            if (err) return output(err);
            data.push(row);
        }, function () {
            if (cb) cb(data);
        });
    }

    this.getMediaBy = (prop, value, limit, cb) => {
        let stmt = `SELECT DISTINCT * FROM media 
                    WHERE ${prop} = '${value}' 
                    ORDER BY id DESC 
                    LIMIT ${limit}`;
        return db.all(stmt, [], function (err, rows) {
            if (err) return failed(err);
            if (cb) cb(rows);
        });

    };

    this.getMedia = (limit, offset, cb) => {
        let stmt = `SELECT DISTINCT * FROM media 
                    ORDER BY id DESC 
                    LIMIT ${limit} 
                    OFFSET ${offset}`;
        return db.all(stmt, [], function (err, rows) {
            if (err) return failed(err);
            if (cb) cb(rows);
        });
    };

    this.insertSession = (tags, followers, cb) => {
        const stmt = `INSERT INTO sessions(
            tags, 
            tag_count,
            followers_count
        ) VALUES(
            ?,
            ?,
            ?
        );`;
        const list = tags.join(',');
        return db.run(stmt, [list,
                tags.length,
                followers
            ],
            function () {
                console.info(`Inserted session with ID ${this.lastID}`);
                if (cb) cb(this.lastID);
            });
    };

    this.closeSession = (data, cb) => {
        const stmt = `UPDATE sessions SET 
                        end_time = strftime('%s', 'now'),
                        like_attempts = ?,
                        like_success = ?,
                        flag_count = ? 
                        WHERE id = ?`;

        return db.run(stmt, [
                data.attemps,
                data.success,
                data.flagCount,
                data.sid
            ],
            function () {
                console.info(`Updated session ID ${this.lastID}`);
                if (cb) cb(this.lastID, data);
            });

    };

    this.insertLike = (sid, igid, hashtag, success, mediaId, cb, errcb) => {
        const stmt = `INSERT INTO likes(
            session_id,
            hashtag, 
            ig_id,
            success,
            media 
        ) VALUES(
            ?,
            ?,
            ?,
            ?,
            ?
        );`;
        return db.run(stmt, [
                sid,
                hashtag,
                igid,
                success,
                mediaId
            ],
            function (err) {
                if (err) {
                    console.log(err);
                    if (errcb) errcb();
                } else {
                    console.info(`Inserted like ID ${this.lastID}`);
                    if (cb) cb(this.lastID);
                }

            });
    };

    this.likeFailed = id => {
        const stmt = `UPDATE likes SET 
                        success = 0 
                        WHERE id = ?`;
        db.run(stmt, [id], function () {
            console.log('Should have marked like ' + id + ' to have failed.');
        });
    };

    this.insertTag = (tag, cb) => {
        if (!validateTag(tag)) return false;
        const stmt = `INSERT INTO hashtags(tag) VALUES('${tag}');`;
        return db.run(stmt, function () {
            console.info(`Inserted tag #${tag} with ID ${this.lastID}`);
            if (cb) cb();
        });
    }

    this.updateLikeCount = (tag, likes) => {
        const stmt = `UPDATE hashtags SET 
                      like_count = like_count + ${likes} 
                      WHERE tag = '${tag}'`;

        return db.run(stmt, [], failed);
    };

    this.updateSessionStats = (sid, total, liked) => {
        const stmt = `UPDATE sessions SET 
                        like_attempts = ?,
                        like_success = ?,
                        end_time = strftime('%s', 'now')
                        WHERE id = ?
                        `;

        return db.run(stmt, [total, liked, sid], failed);
    };

    function failed(err, cb, errcb) {
        if (err) {
            console.error('\r\nERROR !\r\n');
            console.error(err);

        } else {
            if (cb) cb(this);
            if (errcb) errcb(this);
        }
    }

    function createTagsTable() {
        const stmt = `CREATE TABLE IF NOT EXISTS hashtags (
            id INTEGER PRIMARY KEY,
            tag TEXT UNIQUE, 
            like_count INTEGER DEFAULT (0),
            blocked BOOLEAN,
            last_used TIMESTAMP DEFAULT (strftime('%s', 'now')),
            times_used INTEGER DEFAULT (0)
        );`;
        db.run(stmt, createLikesTable);
    };

    function createLikesTable() {
        const stmt = `CREATE TABLE IF NOT EXISTS likes (
                        id INTEGER PRIMARY KEY,
                        session_id INTEGER,
                        hashtag INTEGER,
                        ig_id TEXT, 
                        success BOOLEAN, 
                        time TIMESTAMP DEFAULT (strftime('%s', 'now')),
                        media INTEGER
                    )`;
        db.run(stmt, createMediaTable);
    };

    function createMediaTable() {
        const stmt = `CREATE TABLE IF NOT EXISTS media (
                        id INTEGER PRIMARY KEY,
                        ig_id TEXT UNIQUE, 
                        like_id INTEGER,
                        media_type INTEGER, 
                        taken_at TIMESTAMP,
                        author_username TEXT,
                        author_displayname TEXT,
                        author_avatar TEXT,
                        caption TEXT,
                        web_link TEXT,
                        was_liked BOOLEAN,
                        flag BOOLEAN,
                        photo_url TEXT
                    )`;
        db.run(stmt, createSessionsTable);
    };

    function createSessionsTable() {
        const stmt = `CREATE TABLE IF NOT EXISTS sessions (
                        id INTEGER PRIMARY KEY,
                        tags TEXT,
                        tag_count INTEGER DEFAULT (0),
                        like_attempts INTEGER DEFAULT (0),
                        like_success INTEGER DEFAULT (0), 
                        start_time TIMESTAMP DEFAULT (strftime('%s', 'now')),
                        end_time TIMESTAMP,
                        flags_count INTEGER DEFAULT (0),
                        followers_count INTEGER
                    )`;
        db.run(stmt, createStratsTable);
    };

    function createStratsTable() {
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