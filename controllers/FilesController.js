import { v4 as uuidv4 } from 'uuid';
import { promises as fsPromises } from 'fs';
import { join } from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';


class FilesController {
	// POST /files => FilesController.postUpload
	static async postUpload(req, res) {
		const token = req.header('X-Token');
		const userId = await redisClient.get(`auth_${token}`);
		if (!userId) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const { name, type, parentId = 0, isPublic = false, data } = req.body;

		if (!name) {
			return res.status(400).json({ error: 'Missing name' });
		}

		if (!['folder', 'file', 'image'].includes(type)) {
			return res.status(400).json({ error: 'Missing type' });
		}

		if (type !== 'folder' && !data) {
			return res.status(400).json({ error: 'Missing data' });
		}

		let parentFile = null;
		if (parentId !== 0) {
			parentFile = await dbClient.db.collection('files').findOne({
				_id: dbClient.getObjectId(parentId),
				userId: dbClient.getObjectId(userId),
			});
			if (!parentFile) {
				return res.status(400).json({ error: 'Parent not found' });
			}

			if (parentFile.type !== 'folder') {
				return res.status(400).json({ error: 'Parent is not a folder' });
			}
		}

		const fileData = {
			userId: dbClient.getObjectId(userId),
			name,
			type,
			isPublic,
			parentId: parentId === 0 ? '0' : dbClient.getObjectId(parentId),
		};

		if (type === 'folder') {
			const newFolder = await dbClient.db.collection('files').insertOne(fileData);
			return res.status(201).json({ id: result.insertedId, ...fileDocument });
		} else {
			const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
			await fsPromises.mkdir(folderPath, { recursive: true });

			const localPath = join(folderPath, uuidv4());
			await fsPromises.writeFile(localPath, Buffer.from(data, 'base64'));

			fileDocument.localPath = localPath;

			const result = await dbClient.db.collection('files').insertOne(fileDocument);
			return res.status(201).json({ id: result.insertedId, ...fileDocument });
		}
	}

	// GET /files/:id => FilesController.getShow
	static async getShow(req, res) {
		const token = req.header('X-Token');
		const userId = await redisClient.get(`auth_${token}`);
		if (!userId) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const fileId = req.params.id;
		const file = await dbClient.db.collection('files').findOne({
			_id: dbClient.getObjectId(fileId),
			userId: dbClient.getObjectId(userId),
		});

		if (!file) {
			return res.status(404).json({ error: 'Not found' });
		}

		return res.status(200).json({
			id: file._id,
			userId: file.userId,
			name: file.name,
			type: file.type,
			isPublic: file.isPublic,
			parentId: file.parentId,
		});
	}

	// GET /files => FilesController.getIndex
	static async getIndex(req, res) {
		const token = req.header('X-Token');
		const userId = await redisClient.get(`auth_${token}`);
		if (!userId) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const { parentId = 0, page = 0 } = req.query;
		const pageNum = parseInt(page, 10);
		const query = {
			userId: dbClient.getObjectId(userId),
			parentId: parentId === 0 ? 0 : dbClient.getObjectId(parentId),
		};

		const files = await dbClient.db.collection('files')
		.find(query)
		.skip(pageNum * 20)
		.limit(20)
		.toArray();

		return res.status(200).json(files.map((file) => ({
			id: file._id,
			userId: file.userId,
			name: file.name,
			type: file.type,
			isPublic: file.isPublic,
			parentId: file.parentId,
		})));
	}

	// PUT /files/:id/publish => FilesController.putPublish
	static async putPublish(req, res) {
		const token = req.header('X-Token');
		const userId = await redisClient.get(`auth_${token}`);
		if (!userId) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const fileId = req.params.id;
		const file = await dbClient.db.collection('files').findOne({
			_id: dbClient.getObjectId(fileId),
			userId: dbClient.getObjectId(userId),
		});

		if (!file) {
			return res.status(404).json({ error: 'Not found' });
		}

		await dbClient.db.collection('files').updateOne(
			{ _id: dbClient.getObjectId(fileId) },
			{ $set: { isPublic: true } }
		);

		return res.status(200).json({
			id: file._id,
			userId: file.userId,
			name: file.name,
			type: file.type,
			isPublic: true,
			parentId: file.parentId,
		});
	}

	// PUT /files/:id/unpublish => FilesController.putUnpublish
	static async putUnpublish(req, res) {
		const token = req.header('X-Token');
		const userId = await redisClient.get(`auth_${token}`);
		if (!userId) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const fileId = req.params.id;
		const file = await dbClient.db.collection('files').findOne({
			_id: dbClient.getObjectId(fileId),
			userId: dbClient.getObjectId(userId),
		});

		if (!file) {
			return res.status(404).json({ error: 'Not found' });
		}

		await dbClient.db.collection('files').updateOne(
			{ _id: dbClient.getObjectId(fileId) },
			{ $set: { isPublic: false } }
		);

		return res.status(200).json({
			id: file._id,
			userId: file.userId,
			name: file.name,
			type: file.type,
			isPublic: false,
			parentId: file.parentId,
		});
	}
}

export default FilesController;
