import { v4 as uuidv4 } from 'uuid';
import { promises as fsPromises } from 'fs';
import { join } from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';


class FilesController {
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

		if (parentId !== 0) {
			const parentFile = await dbClient.db.collection('files').findOne({ _id: dbClient.getObjectId(parentId) });

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
			return res.status(201).json({
				id: newFolder.insertedId,
				userId,
				name,
				type,
				isPublic,
				parentId,
			});
		}

		const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
		const localPath = join(folderPath, uuidv4());

		try {
			await fsPromises.mkdir(folderPath, { recursive: true });
			await fsPromises.writeFile(localPath, Buffer.from(data, 'base64'));

			fileData.localPath = localPath;

			const newFile = await dbClient.db.collection('files').insertOne(fileData);
			return res.status(201).json({
				id: newFile.insertedId,
				userId,
				name,
				type,
				isPublic,
				parentId,
			});
		} catch (err) {
			return res.status(500).json({ error: 'Cannot save the file' });
		}
	}

	static async getShow(req, res) {
		const token = req.header('X-Token');
		const userId = await redisClient.get(`auth_${token}`);
		if (!userId) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const fileId = req.params.id;
		const file = await dbClient.db.collection('files').findOne({ _id: dbClient.getObjectId(fileId), userId: dbClient.getObjectId(userId) });

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

	static async getIndex(req, res) {
		const token = req.header('X-Token');
		const userId = await redisClient.get(`auth_${token}`);
		if (!userId) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const parentId = req.query.parentId || '0';
		const page = parseInt(req.query.page, 10) || 0;
		const pageSize = 20;

		const files = await dbClient.db.collection('files')
		.aggregate([
			{ $match: { userId: dbClient.getObjectId(userId), parentId } },
			{ $skip: page * pageSize },
			{ $limit: pageSize },
		])
		.toArray();

		const formattedFiles = files.map((file) => ({
			id: file._id,
			userId: file.userId,
			name: file.name,
			type: file.type,
			isPublic: file.isPublic,
			parentId: file.parentId,
		}));

		return res.status(200).json(formattedFiles);

	}
}

export default FilesController;
