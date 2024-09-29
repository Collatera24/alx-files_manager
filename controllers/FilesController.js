import { promises as fsPromises } from 'fs';
import { join } from 'path';
import { lookup } from 'mime-types';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  // GET /files/:id => FilesController.getShow
  static async getShow(req, res) {
    const fileId = req.params.id;
    const token = req.header('X-Token') || null;

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const file = await dbClient.db.collection('files').findOne({
      _id: dbClient.getObjectId(fileId),
      userId,
    });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(file);
  }

  // GET /files => FilesController.getIndex
  static async getIndex(req, res) {
    const token = req.header('X-Token') || null;
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parentId = req.query.parentId || '0';
    const page = parseInt(req.query.page, 10) || 0;

    const query = { userId, parentId };
    const limit = 20;
    const skip = page * limit;

    const files = await dbClient.db.collection('files')
      .find(query)
      .skip(skip)
      .limit(limit)
      .toArray();

    return res.status(200).json(files);
  }

  // PUT /files/:id/publish => FilesController.putPublish
  static async putPublish(req, res) {
    const fileId = req.params.id;
    const token = req.header('X-Token') || null;

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const file = await dbClient.db.collection('files').findOne({
      _id: dbClient.getObjectId(fileId),
      userId,
    });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.db.collection('files').updateOne(
      { _id: dbClient.getObjectId(fileId) },
      { $set: { isPublic: true } }
    );

    const updatedFile = await dbClient.db.collection('files').findOne({
      _id: dbClient.getObjectId(fileId),
    });

    return res.status(200).json(updatedFile);
  }

  // PUT /files/:id/unpublish => FilesController.putUnpublish
  static async putUnpublish(req, res) {
    const fileId = req.params.id;
    const token = req.header('X-Token') || null;

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const file = await dbClient.db.collection('files').findOne({
      _id: dbClient.getObjectId(fileId),
      userId,
    });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.db.collection('files').updateOne(
      { _id: dbClient.getObjectId(fileId) },
      { $set: { isPublic: false } }
    );

    const updatedFile = await dbClient.db.collection('files').findOne({
      _id: dbClient.getObjectId(fileId),
    });

    return res.status(200).json(updatedFile);
  }

  // GET /files/:id/data => FilesController.getFile
  static async getFile(req, res) {
    const fileId = req.params.id;
    const token = req.header('X-Token') || null;

    const file = await dbClient.db.collection('files').findOne({
      _id: dbClient.getObjectId(fileId),
    });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    // Check if the file is public or if the user is authorized
    if (!file.isPublic) {
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId || userId !== file.userId.toString()) {
        return res.status(404).json({ error: 'Not found' });
      }
    }

    // Check if the file is locally present
    try {
      const content = await fsPromises.readFile(file.localPath);
      const mimeType = lookup(file.name) || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);
      return res.status(200).send(content);
    } catch (err) {
      return res.status(404).json({ error: 'Not found' });
    }
  }
}

export default FilesController;
