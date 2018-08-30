/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IncomingMessage } from 'http';
import * as path from 'path';
import { getKuduClient, SiteClient } from 'vscode-azureappservice';
import { IAzureParentTreeItem, IAzureTreeItem } from 'vscode-azureextensionui';
import KuduClient from 'vscode-azurekudu';
import { FileTreeItem } from './FileTreeItem';

export class FolderTreeItem implements IAzureParentTreeItem {
    public static contextValue: string = 'folder';
    public readonly contextValue: string;
    public readonly childTypeLabel: string = 'files';

    constructor(readonly client: SiteClient, readonly label: string, readonly folderPath: string, readonly subcontextValue?: string) {
        this.contextValue = subcontextValue ? subcontextValue : FolderTreeItem.contextValue;
    }

    public get iconPath(): { light: string, dark: string } | undefined {
        return this.contextValue === 'subFolder' ? undefined : {
            light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Folder_16x.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Folder_16x.svg')
        }; // no icons for subfolders
    }

    public hasMoreChildren(): boolean {
        return false;
    }

    public async loadMoreChildren(): Promise<IAzureTreeItem[]> {
        const kuduClient: KuduClient = await getKuduClient(this.client);
        const httpResponse: kuduIncomingMessage = <kuduIncomingMessage>(await kuduClient.vfs.getItemWithHttpOperationResponse(this.folderPath)).response;
        // response contains a body with a JSON parseable string
        const fileList: kuduFile[] = <kuduFile[]>JSON.parse(httpResponse.body);
        const home: string = 'home';
        const filteredList: kuduFile[] = fileList.filter((file: kuduFile) => {
            if (file.mime === 'text/xml' && file.name.includes('LogFiles-kudu-trace_pending.xml')) {
                // this file is being accessed by Kudu and is not viewable
                return false;
            }
            return true;
        });
        return filteredList.map((file: kuduFile) => {
            return file.mime === 'inode/directory' ?
                // truncate the home of the path
                // the substring starts at file.path.indexOf(home) because the path sometimes includes site/ or D:\
                // the home.length + 1 is to account for the trailing slash, Linux uses / and Window uses \
                new FolderTreeItem(this.client, file.name, file.path.substring(file.path.indexOf(home) + home.length + 1), 'subFolder') :
                new FileTreeItem(this.client, file.name, file.path.substring(file.path.indexOf(home) + home.length + 1));
        });
    }
}

type kuduFile = { mime: string, name: string, path: string };
type kuduIncomingMessage = IncomingMessage & { body: string };
