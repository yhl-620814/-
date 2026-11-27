import { ADMIN_TMAIL_EMAIL } from '../types';

export interface DriveUploadResult {
  fileId: string;
  name: string;
  webViewLink: string;
  mimeType: string;
  sharedWithAdmin: boolean;
}

export interface DriveFolderResult {
  folderId: string;
  folderName: string;
  folderUrl: string;
}

/**
 * Finds or creates a folder in the signed-in user's Google Drive (scoped to drive.file).
 */
async function findOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<DriveFolderResult> {
  const escapedName = folderName.replace(/'/g, "\\'");
  const queryParts = [
    `name = '${escapedName}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `trashed = false`,
  ];
  if (parentId) {
    queryParts.push(`'${parentId}' in parents`);
  }

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      queryParts.join(' and ')
    )}&fields=files(id,name,webViewLink)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (searchRes.ok) {
    const searchData = (await searchRes.json()) as {
      files?: Array<{ id: string; name: string; webViewLink?: string }>;
    };
    const existing = searchData.files?.[0];
    if (existing) {
      return {
        folderId: existing.id,
        folderName: existing.name,
        folderUrl:
          existing.webViewLink || `https://drive.google.com/drive/folders/${existing.id}`,
      };
    }
  }

  const metadata: Record<string, unknown> = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`無法建立 Google 雲端硬碟資料夾：${errText}`);
  }

  const created = (await createRes.json()) as {
    id: string;
    name: string;
    webViewLink?: string;
  };
  return {
    folderId: created.id,
    folderName: created.name,
    folderUrl: created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`,
  };
}

/**
 * Admin helper: creates a dedicated root folder in yhl@tmail.ilc.edu.tw's Drive
 * and grants @tmail.ilc.edu.tw domain writer permission so schools can deposit files.
 */
export async function createAdminCollectionFolder(
  accessToken: string,
  folderName = '宜蘭縣各校資料繳交彙整區'
): Promise<DriveFolderResult> {
  const folder = await findOrCreateFolder(accessToken, folderName);

  // Share with @tmail.ilc.edu.tw domain so authenticated school staff can submit into it
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      folder.folderId
    )}/permissions?sendNotificationEmail=false`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'writer',
        type: 'domain',
        domain: 'tmail.ilc.edu.tw',
      }),
    }
  ).catch(() => null);

  return folder;
}

async function uploadMultipartToDrive(
  accessToken: string,
  file: File,
  metadata: Record<string, unknown>
): Promise<{ id: string; name: string; webViewLink?: string; mimeType?: string }> {
  const boundary = `ilc_upload_${crypto.randomUUID().replace(/-/g, '')}`;
  const metadataPart = JSON.stringify(metadata);
  const fileBuffer = await file.arrayBuffer();

  const headerPart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadataPart}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;
  const footerPart = `\r\n--${boundary}--`;

  const encoder = new TextEncoder();
  const bodyBlob = new Blob(
    [encoder.encode(headerPart), fileBuffer, encoder.encode(footerPart)],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,mimeType',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: bodyBlob,
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Google 雲端硬碟上傳失敗 (${res.status})：${errBody}`);
  }

  return (await res.json()) as {
    id: string;
    name: string;
    webViewLink?: string;
    mimeType?: string;
  };
}

/**
 * Uploads a school's file to Google Drive and shares it directly with the administrator's
 * Tmail Google Drive (yhl@tmail.ilc.edu.tw) so the admin always receives access.
 */
export async function uploadSchoolFileToDrive(
  accessToken: string,
  file: File,
  options: {
    schoolName: string;
    itemTitle: string;
    targetFolderId?: string;
    uploaderEmail?: string;
  }
): Promise<DriveUploadResult> {
  const formattedName = `[${options.schoolName}]_${options.itemTitle}_${file.name}`;
  const isUploaderAdmin =
    options.uploaderEmail?.toLowerCase() === ADMIN_TMAIL_EMAIL.toLowerCase();

  let uploaded: { id: string; name: string; webViewLink?: string; mimeType?: string } | null =
    null;

  // Attempt 1: If a shared admin folder ID is configured, try placing directly inside it
  if (options.targetFolderId) {
    try {
      uploaded = await uploadMultipartToDrive(accessToken, file, {
        name: formattedName,
        parents: [options.targetFolderId],
      });
    } catch {
      // Fall back to user's organized app folder + explicit sharing with admin Tmail
      uploaded = null;
    }
  }

  // Attempt 2: Create/reuse a clean local folder in the user's Drive and upload there
  if (!uploaded) {
    const folder = await findOrCreateFolder(
      accessToken,
      `宜蘭縣學校資料上傳_${options.schoolName}`
    );
    uploaded = await uploadMultipartToDrive(accessToken, file, {
      name: formattedName,
      parents: [folder.folderId],
    });
  }

  // Grant writer/reader access directly to yhl@tmail.ilc.edu.tw if uploader is not already admin
  let sharedWithAdmin = isUploaderAdmin;
  if (!isUploaderAdmin) {
    try {
      const permRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          uploaded.id
        )}/permissions?sendNotificationEmail=false`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            role: 'writer',
            type: 'user',
            emailAddress: ADMIN_TMAIL_EMAIL,
          }),
        }
      );
      if (permRes.ok) {
        sharedWithAdmin = true;
      }
    } catch {
      sharedWithAdmin = false;
    }
  }

  return {
    fileId: uploaded.id,
    name: uploaded.name,
    webViewLink: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
    mimeType: uploaded.mimeType || file.type || 'application/octet-stream',
    sharedWithAdmin,
  };
}
