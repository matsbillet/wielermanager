const jwt = require('jsonwebtoken');

function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Geen geldig token.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        if (!payload.is_admin) {
            return res.status(403).json({ error: 'Geen toegang. Alleen admins.' });
        }

        req.gebruiker = payload;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Ongeldig token.' });
    }
}

module.exports = requireAdmin;