"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const evidenceController_1 = require("../controllers/evidenceController");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/tiff',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'audio/mpeg',
            'audio/wav',
            'audio/ogg',
            'audio/webm',
            'video/mp4',
            'video/quicktime',
            'video/x-msvideo',
            'video/x-ms-wmv',
            'video/webm',
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed',
            'text/plain',
            'text/csv',
            'application/json'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Please upload a supported evidence file format.'), false);
        }
    }
});
router.post('/', auth_1.authenticate, upload.single('file'), evidenceController_1.evidenceController.createEvidence.bind(evidenceController_1.evidenceController));
router.get('/:id', auth_1.authenticate, evidenceController_1.evidenceController.getEvidence.bind(evidenceController_1.evidenceController));
router.put('/:id', auth_1.authenticate, evidenceController_1.evidenceController.updateEvidence.bind(evidenceController_1.evidenceController));
router.delete('/:id', auth_1.authenticate, evidenceController_1.evidenceController.deleteEvidence.bind(evidenceController_1.evidenceController));
router.get('/search', auth_1.authenticate, evidenceController_1.evidenceController.searchEvidence.bind(evidenceController_1.evidenceController));
router.post('/:id/chain', auth_1.authenticate, evidenceController_1.evidenceController.addToChainOfCustody.bind(evidenceController_1.evidenceController));
router.get('/:id/chain', auth_1.authenticate, evidenceController_1.evidenceController.getChainOfCustody.bind(evidenceController_1.evidenceController));
router.get('/:id/download', auth_1.authenticate, evidenceController_1.evidenceController.downloadEvidence.bind(evidenceController_1.evidenceController));
exports.default = router;
//# sourceMappingURL=evidence.js.map