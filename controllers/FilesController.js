import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const writeFile = promisify(fs.writeFile);

class FilesController {
	static async postUpload(req, res) {
		const token = req.header('X-Token');
		if (!token) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const tokenKey = `auth_${token}`;
		const userId = await redisClient.get(tokenKey);
		if (!userId) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const { name, type, parentId = 0, isPublic = false, data } = req.body;

		if (!name) {
			return res.status(400).json({ error: 'Missing name' });
		}

		if (!type || !['folder', 'file', 'image'].includes(type)) {
			return res.status(400).json({ error: 'Missing type' });
		}

		if (type !== 'folder' && !data) {
			return res.status(400).json({ error: 'Missing data' });
		}

		const filesCollection = dbClient.db.collection('files');

		if (parentId !== 0) {
			const parentFile = await filesCollection.findOne({ _id: dbClient.client.s.options.objectId(parentId) });

			if (!parentFile) {
				return res.status(400).json({ error: 'Parent not found' });
			}

			if (parentFile.type !== 'folder') {
				return res.status(400).json({ error: 'Parent is not a folder' });
			}
		}

		const fileDocument = {
			userId,
			name,
			type,
			isPublic,
			parentId,
		};

		if (type === 'folder') {
			const result = await filesCollection.insertOne(fileDocument);
			return res.status(201).json({
				id: result.insertedId,
				userId,
				name,
				type,
				isPublic,
				parentId,
			});
		}

		const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
		if (!fs.existsSync(FOLDER_PATH)) {
			fs.mkdirSync(FOLDER_PATH, { recursive: true });
		}

		const fileUuid = uuidv4();
		const localPath = path.join(FOLDER_PATH, fileUuid);

		try {
			const decodedData = Buffer.from(data, 'base64');
			await writeFile(localPath, decodedData);

			fileDocument.localPath = localPath;
			const result = await filesCollection.insertOne(fileDocument);
			return res.status(201).json({
				id: result.insertedId,
				userId,
				name,
				type,
				isPublic,
				parentId,
			});
		} catch (error) {
			return res.status(500).json({ error: 'Internal server error' });
		}
	}
}

export default FilesController;
