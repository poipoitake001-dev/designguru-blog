const crypto = require('crypto');
const bcrypt = require('bcryptjs');

function readEnv(name) {
    const value = process.env[name];
    return typeof value === 'string' ? value.trim() : '';
}

function getJwtSecret() {
    return readEnv('JWT_SECRET');
}

function getAdminPasswordConfig() {
    return {
        adminPassword: readEnv('ADMIN_PASSWORD'),
        adminPasswordHash: readEnv('ADMIN_PASSWORD_HASH')
    };
}

function getMissingAuthConfig() {
    const missing = [];
    const jwtSecret = getJwtSecret();
    const { adminPassword, adminPasswordHash } = getAdminPasswordConfig();

    if (!jwtSecret) {
        missing.push('JWT_SECRET');
    }

    if (!adminPassword && !adminPasswordHash) {
        missing.push('ADMIN_PASSWORD or ADMIN_PASSWORD_HASH');
    }

    return missing;
}

function safeCompare(left, right) {
    const leftHash = crypto.createHash('sha256').update(left).digest();
    const rightHash = crypto.createHash('sha256').update(right).digest();
    return crypto.timingSafeEqual(leftHash, rightHash);
}

async function verifyAdminPassword(password) {
    const { adminPassword, adminPasswordHash } = getAdminPasswordConfig();

    if (typeof password !== 'string' || !password) {
        return false;
    }

    if (adminPasswordHash) {
        return bcrypt.compare(password, adminPasswordHash);
    }

    if (adminPassword) {
        return safeCompare(password, adminPassword);
    }

    return false;
}

module.exports = {
    getJwtSecret,
    getMissingAuthConfig,
    verifyAdminPassword
};
