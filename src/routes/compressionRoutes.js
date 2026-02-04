const express = require('express');
const router = express.Router();

const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const compressionController = require('../controllers/compressionController');

router.use(auth);

router.post('/upload', upload.single('file'), compressionController.uploadAndCompress);

module.exports = router;

