/* eslint-disable */

import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
	static async getConnect(req, res) {
		const authHeader = req.header('Authorization');
		if (!authHeader || !authHeader.startsWith('Basic ')) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const encodedCredentials = authHeader.split(' ')[1];
		const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
		const [email, password] = decodedCredentials.split(':');

		if (!email || !password) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const hashedPassword = sha1(password);
		const usersCollection = dbClient.db.collection('users');
		const user = await usersCollection.findOne({ email, password: hashedPassword });

		if (!user) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const token = uuidv4();
		const tokenKey = `auth_${token}`;

		await redisClient.set(tokenKey, user._id.toString(), 60 * 60 * 24);

		return res.status(200).json({ token });
	}

	static async getDisconnect(req, res) {
		const token = req.header('X-Token');

		if (!token) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		const tokenKey = `auth_${token}`;
		const userId = await redisClient.get(tokenKey);

		if (!userId) {
			return res.status(401).json({ error: 'Unauthorized' });
		}

		await redisClient.del(tokenKey);
		return res.status(204).send();
	}
}

export default AuthController;
