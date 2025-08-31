"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const templateController_1 = require("../controllers/templateController");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/pdf',
            'application/msword',
            'application/vnd.ms-excel',
            'application/vnd.ms-powerpoint',
            'text/plain',
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only document templates are allowed.'), false);
        }
    }
});
router.post('/', auth_1.authenticate, upload.single('file'), templateController_1.templateController.createTemplate.bind(templateController_1.templateController));
router.get('/', auth_1.authenticate, templateController_1.templateController.getTemplates.bind(templateController_1.templateController));
router.get('/:id', auth_1.authenticate, templateController_1.templateController.getTemplate.bind(templateController_1.templateController));
router.put('/:id', auth_1.authenticate, templateController_1.templateController.updateTemplate.bind(templateController_1.templateController));
router.delete('/:id', auth_1.authenticate, templateController_1.templateController.deleteTemplate.bind(templateController_1.templateController));
router.post('/:id/generate', auth_1.authenticate, templateController_1.templateController.generateFromTemplate.bind(templateController_1.templateController));
router.get('/:id/download', auth_1.authenticate, templateController_1.templateController.downloadTemplate.bind(templateController_1.templateController));
exports.default = router;
//# sourceMappingURL=templates.js.map