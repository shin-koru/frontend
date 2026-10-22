import { HttpContextToken } from '@angular/common/http';
export const SILENT_HTTP_ERROR = new HttpContextToken(() => false);
