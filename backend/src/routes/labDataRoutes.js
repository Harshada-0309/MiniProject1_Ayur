const express = require('express');
const {
  updateLabData,
  deleteLabData,
  deleteLabAttachment,
} = require('../controllers/labDataController');
const { validateLabDataInput } = require('../middleware/validation');

const router = express.Router();

router.put('/:id', validateLabDataInput, updateLabData);
router.delete('/:id', deleteLabData);
router.delete('/:id/attachment', deleteLabAttachment);

module.exports = router;
