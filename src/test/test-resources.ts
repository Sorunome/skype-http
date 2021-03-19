import fs from 'fs';
import path from 'path';

const testResourcesRoot: string = path.join(__dirname, 'test-resources');

export function readTextTestResource(filePath: string): string {
  return fs.readFileSync(path.resolve(testResourcesRoot, filePath), 'utf8');
}
