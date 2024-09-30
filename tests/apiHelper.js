/* eslint-disable */

import request from 'supertest';
import app from '../app'; // Assuming you export the express instance from your main file

export default request(app);

