const bcrypt = require('bcryptjs');
bcrypt.hash('poi2026admin', 10).then(h => console.log(h));
