module.exports = function(db){

    return {
        latestMedia: (req, res) => {
            const limit = req.body.limit || 50;
            const page = req.body.page || 1;
            const offset = (page - 1) * limit;

            db.getMedia(limit, offset, function(media){
                res.json(media);
            });
        },
        lastSession: (req, res) => {
            
        }
    }
};