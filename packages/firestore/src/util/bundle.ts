/**
 * @license
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as api from '../protos/firestore_proto_api';

// Provides a high level API to read bundles.
export class Bundle {
  private bundleMetadata: BundleMetadata|null = null;
  private namedQueries: Array<NamedQuery>|null = null;
  private documents: Array<[BundledDocumentMetadata, string]>|null = null;
  private elementCursor: BundleElementCursor|null =null;

  constructor(private bundleUrlOrBlob: URL|Blob) {
    if(bundleUrlOrBlob instanceof  Blob){
      this.elementCursor = new BundleElementCursor((bundleUrlOrBlob as Blob));
    }
  }

  getBundleMetadata():BundleMetadata {
    if(this.elementCursor!.position > 0 && this.bundleMetadata === null) {
      // Throws
    }

    if(this.elementCursor!.position === 0) {
      this.bundleMetadata = this.elementCursor!.readAsBundleMetadata();
      this.elementCursor!.next();
    }
    return this.bundleMetadata!;
  }

 getNamedQueries():Array<NamedQuery> {
    this.getBundleMetadata();

    if(this.namedQueries !== null) {
      return this.namedQueries!;
    }

    this.namedQueries = [];
    let namedQuery = this.elementCursor!.readAsNamedQuery();
    while(namedQuery !== null) {
      this.namedQueries.push(namedQuery);
      this.elementCursor!.next();
      namedQuery = this.elementCursor!.readAsNamedQuery();
    }

    return this.namedQueries!;
  }

  getDocuments():Array<[BundledDocumentMetadata, string]> {
    // TODO(): This should be cursor based as well.
    this.getNamedQueries();

    if(this.documents !== null) {
      return this.documents!;
    }

    this.documents = [];
    let docMetadata = this.elementCursor!.readAsDocumentMetadata();
    while(docMetadata !== null && this.elementCursor!.hasMore()) {
      this.elementCursor!.next();
      const docString = this.elementCursor!.readAsDocumentJsonString();
      this.elementCursor!.next();
      this.documents.push([docMetadata, docString!]);
      if(this.elementCursor!.hasMore()) {
        docMetadata = this.elementCursor!.readAsDocumentMetadata();
      }
    }

    return this.documents!;
  }
}

interface Timestamp {
  /** Timestamp seconds */
  seconds?: (number|null);

  /** Timestamp nanos */
  nanos?: (number|null);
}

interface BundleMetadata{
  /** BundleMetadata name */
  name?: (string|null);

  /** BundleMetadata createTime */
  createTime?: (Timestamp|null);
}

interface NamedQuery {
  /** NamedQuery name */
  name?: (string|null);

  /** NamedQuery queryTarget */
  queryTarget?: (api.QueryTarget|null);

  /** NamedQuery readTime */
  readTime?: (Timestamp|null);
}

/** Properties of a BundledDocumentMetadata. */
interface BundledDocumentMetadata {

  /** BundledDocumentMetadata documentKey */
  documentKey?: (string|null);

  /** BundledDocumentMetadata readTime */
  readTime?: (Timestamp|null);
}

class BundleElementCursor {
  private readFrom = 0;
  private reader = new FileReader();

  constructor(private data: Blob) {}

  // Returns a Blob representing the next bundle element.
  public readElement(): Blob {
    const length = this.readLength();
    const result = this.data.slice(this.readFrom + 4, this.readFrom + 4 + length);
    return result;
  }

  public readAsBundleMetadata(): BundleMetadata | null {
    this.reader.readAsText(this.readElement());
    return JSON.parse(this.reader.result as string);
  }

  public readAsNamedQuery(): NamedQuery | null {
    this.reader.readAsText(this.readElement());
    return JSON.parse(this.reader.result as string);
  }

  public readAsDocumentMetadata(): BundledDocumentMetadata | null {
    this.reader.readAsText(this.readElement());
    return JSON.parse(this.reader.result as string);
  }

  public readAsDocumentJsonString(): string | null {
    this.reader.readAsText(this.readElement());
    return this.reader.result as string;
  }

  public next(): void {
    const length = this.readLength();
    this.readFrom = this.readFrom + 4 + length;
  }

  private readLength(): number {
    const lengthBlob = this.data.slice(this.readFrom, this.readFrom + 4);
    return this.toUInt32LE(lengthBlob);
  }

  private toUInt32LE(blob: Blob): number{
    this.reader.readAsArrayBuffer(blob);
    const length = new DataView(this.reader.result as ArrayBuffer).getUint32(0, true);
    return length;
  }

  public hasMore():boolean {
    return this.data.size > this.readFrom;
  }

  public get position() {
    return this.readFrom;
  }
}
