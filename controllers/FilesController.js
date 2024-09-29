import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import { getUserFromToken } from '../utils/auth';
import { Queue } from 'bull';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import imageThumbnail from 'image-thumbnail';

// Create file queue
const fileQueue = new Queue('fileQueue');
const readFile = promisify(fs.readFile);

class FilesController {
  // POST /files
  static async postUpload(req, res) {
    const user = await getUserFromToken(req.headers['x-token']);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, type, parentId, isPublic = false, data } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    let parentFile = null;
    if (parentId) {
      parentFile = await dbClient.collection('files').findOne({ _id: ObjectId(parentId), userId: user._id });
      if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const fileData = {
      userId: user._id,
      name,
      type,
      parentId: parentId ? ObjectId(parentId) : 0,
      isPublic,
      createdAt: new Date(),
    };

    if (type !== 'folder') {
      const filePath = `/tmp/files_manager/${uuidv4()}`;
      await fs.promises.writeFile(filePath, Buffer.from(data, 'base64'));
      fileData.localPath = filePath;
    }

    const result = await dbClient.collection('files').insertOne(fileData);
    const newFile = {
      id: result.insertedId,
      userId: fileData.userId,
      name: fileData.name,
      type: fileData.type,
      isPublic: fileData.isPublic,
      parentId: fileData.parentId,
    };

    if (type === 'image') {
      fileQueue.add({ userId: user._id, fileId: result.insertedId });
    }

    return res.status(201).json(newFile);
  }

  // GET /files/:id
  static async getShow(req, res) {
    const user = await getUserFromToken(req.headers['x-token']);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.collection('files').findOne({ _id: ObjectId(fileId), userId: user._id });

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

  // GET /files
  static async getIndex(req, res) {
    const user = await getUserFromToken(req.headers['x-token']);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parentId = req.query.parentId ? ObjectId(req.query.parentId) : 0;
    const page = parseInt(req.query.page, 10) || 0;

    const files = await dbClient.collection('files')
      .find({ userId: user._id, parentId })
      .skip(page * 20)
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

  // PUT /files/:id/publish
  static async putPublish(req, res) {
    const user = await getUserFromToken(req.headers['x-token']);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.collection('files').findOne({ _id: ObjectId(fileId), userId: user._id });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.collection('files').updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: true } });

    file.isPublic = true;
    return res.status(200).json(file);
  }

  // PUT /files/:id/unpublish
  static async putUnpublish(req, res) {
    const user = await getUserFromToken(req.headers['x-token']);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.collection('files').findOne({ _id: ObjectId(fileId), userId: user._id });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.collection('files').updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: false } });

    file.isPublic = false;
    return res.status(200).json(file);
  }

  // GET /files/:id/data
  static async getFile(req, res) {
    const { id } = req.params;
    const { size } = req.query;

    const file = await dbClient.collection('files').findOne({ _id: ObjectId(id) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    const user = await getUserFromToken(req.headers['x-token']);
    if (!file.isPublic && (!user || file.userId.toString() !== user._id.toString())) {
      return res.status(404).json({ error: 'Not found' });
    }

    let filePath = file.localPath;
    if (size && ['100', '250', '500'].includes(size)) {
      filePath = `${filePath}_${size}`;
    }

    try {
      const data = await readFile(filePath);
      const mimeType = mime.lookup(file.name);
      res.setHeader('Content-Type', mimeType);
      return res.status(200).send(data);
    } catch (err) {
      return res.status(404).json({ error: 'Not found' });
    }
  }
}

export default FilesController;
