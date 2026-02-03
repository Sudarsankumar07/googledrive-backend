const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const aiController = require('../controllers/aiController');

router.use(auth);

router.post('/chat', aiController.chat);
router.post('/summarize/:fileId', aiController.summarize);
router.post('/auto-tag/:fileId', aiController.autoTag);
router.post('/search', aiController.search);
router.get('/insights', aiController.insights);

module.exports = router;

