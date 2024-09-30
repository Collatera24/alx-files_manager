/* eslint-disable */

import apiHelper from './apiHelper';
import { expect } from 'chai';

describe('Files Endpoints', () => {
	let token;
	let fileId;


	before(async () => {
		// Get the token for authentication
		const res = await apiHelper.get('/connect')
		.set('Authorization', 'Basic dGVzdEBleGFtcGxlLmNvbToxMjM0NTY=');
		token = res.body.token;
	});


	it('should upload a file', async () => {
		const res = await apiHelper.post('/files')
		.set('X-Token', token)
		.send({
			name: 'testFile.txt',
			type: 'file',
			data: Buffer.from('Hello World').toString('base64'),
		});
		expect(res.status).to.equal(201);
		expect(res.body).to.have.property('id');
		fileId = res.body.id;
	});


	it('should get the file by ID', async () => {
		const res = await apiHelper.get(`/files/${fileId}`)
		.set('X-Token', token);
		expect(res.status).to.equal(200);
		expect(res.body).to.have.property('name', 'testFile.txt');
	});


	it('should paginate files', async () => {
		const res = await apiHelper.get('/files?page=0')
		.set('X-Token', token);
		expect(res.status).to.equal(200);
		expect(res.body).to.be.an('array');
	});


	it('should publish a file', async () => {
		const res = await apiHelper.put(`/files/${fileId}/publish`)
		.set('X-Token', token);
		expect(res.status).to.equal(200);
		expect(res.body).to.have.property('isPublic', true);
	});


	it('should unpublish a file', async () => {
		const res = await apiHelper.put(`/files/${fileId}/unpublish`)
		.set('X-Token', token);
		expect(res.status).to.equal(200);
		expect(res.body).to.have.property('isPublic', false);
	});


	it('should get file content', async () => {
		const res = await apiHelper.get(`/files/${fileId}/data`)
		.set('X-Token', token);
		expect(res.status).to.equal(200);
		expect(res.text).to.equal('Hello World');
	});
});
