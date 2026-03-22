const bcrypt = require('bcryptjs');
bcrypt.hash('pp789789', 10).then(h => console.log(h));
