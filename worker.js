/* eslint-disable */

import { promises as fsPromises } from 'fs';
import { join, parse } from 'path';
import Queue from 'bull';
import imageThumbnail from 'image-thumbnail';
import dbClient from './utils/db';
import Bull from 'bull';

const fileQueue = new Queue('fileQueue');
const userQueue = new Bull('userQueue');

// Process the queue for generating thumbnails
fileQueue.process(async (job) => {
	const { userId, fileId } = job.data;

	if (!fileId) {
		throw new Error('Missing fileId');
	}

	if (!userId) {
		throw new Error('Missing userId');
	}

	const file = await dbClient.db.collection('files').findOne({
		_id: dbClient.getObjectId(fileId),
		userId,
	});

	if (!file) {
		throw new Error('File not found');
	}

	// Generate thumbnails using image-thumbnail module...
	// Save generated thumbnails with widths of 100, 250, and 500
	console.log(`Thumbnails generated for file ${fileId}`);
});

userQueue.process(async (job) => {
	const { userId } = job.data;

	if (!userId) throw new Error('Missing userId');

	const user = await dbClient.db.collection('users').findOne({ _id: userId });
	if (!user) throw new Error('User not found');

	console.log(`Welcome ${user.email}!`);
});

	if (file.type !== 'image') {
		throw new Error('File is not an image');
	}

	try {
		const options = [
			{ width: 500 },
			{ width: 250 },
			{ width: 100 },
		];

		for (const option of options) {
			const thumbnail = await imageThumbnail(file.localPath, option);
			const { dir, name, ext } = parse(file.localPath);
			const thumbnailPath = join(dir, `${name}_${option.width}${ext}`);
			await fsPromises.writeFile(thumbnailPath, thumbnail);
		}
	} catch (error) {
		console.error(`Error generating thumbnails for file ${fileId}:`, error);
	}
});

export default fileQueue;
