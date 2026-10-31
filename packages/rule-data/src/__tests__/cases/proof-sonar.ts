import type { RuleCase } from './changed-settings.ts'

// The sonarjs rules ESLint runs, each on the gate's fixture (or a shape the current plugin reports where the gate's no
// longer fires) and on its corrected form. sonarjs/no-default-utility-imports has no case: it reports only where the
// nearest package.json lists the library, and a case writes no package.json.

/** Each shipped sonarjs rule routed to ESLint that no other case list proves, run as the catalog ships it. */
export const PROOF_SONAR_CASES: readonly RuleCase[] = [
  {
    rule: 'sonarjs/anchor-precedence',
    silentIn: [
      {
        path: 'src/anchor-precedence-corrected.ts',
        source: `export const re = /^(?:abc|def)/
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/anchor-precedence.ts',
        source: `const re = /^abc|def/
`,
      },
    ],
  },
  {
    rule: 'sonarjs/argument-type',
    silentIn: [
      {
        path: 'src/argument-type-corrected.ts',
        source: `declare const raw: string
export const rounded = Math.round(Number(raw))
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/argument-type.ts',
        source: `declare const raw: string
export const rounded = Math.round(raw)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/arguments-order',
    silentIn: [
      {
        path: 'src/arguments-order-corrected.ts',
        source: `function f(a: number, b: number) { return a - b }
const a = 1, b = 2
export const difference = f(a, b)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/arguments-order.ts',
        source: `function f(a: number, b: number) { return a - b }
const a = 1, b = 2
f(b, a)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/aws-apigateway-public-api',
    silentIn: [
      {
        path: 'src/aws-apigateway-public-api-corrected.ts',
        source: `import * as apigw from 'aws-cdk-lib/aws-apigateway'
declare const scope: any
new apigw.CfnMethod(scope, 'm', { authorizationType: 'AWS_IAM' })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/aws-apigateway-public-api.ts',
        source: `import * as apigw from 'aws-cdk-lib/aws-apigateway'
declare const scope: any
new apigw.CfnMethod(scope, 'm', {})
`,
      },
    ],
  },
  {
    rule: 'sonarjs/aws-ec2-rds-dms-public',
    silentIn: [
      {
        path: 'src/aws-ec2-rds-dms-public-corrected.ts',
        source: `import * as dms from 'aws-cdk-lib/aws-dms'
declare const scope: any
new dms.CfnReplicationInstance(scope, 'r', { publiclyAccessible: false })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/aws-ec2-rds-dms-public.ts',
        source: `import * as dms from 'aws-cdk-lib/aws-dms'
declare const scope: any
new dms.CfnReplicationInstance(scope, 'r', { publiclyAccessible: true })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/aws-ec2-unencrypted-ebs-volume',
    silentIn: [
      {
        path: 'src/aws-ec2-unencrypted-ebs-volume-corrected.ts',
        source: `import * as ec2 from 'aws-cdk-lib/aws-ec2'
declare const scope: any
new ec2.Volume(scope, 'v', { encrypted: true })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/aws-ec2-unencrypted-ebs-volume.ts',
        source: `import * as ec2 from 'aws-cdk-lib/aws-ec2'
declare const scope: any
new ec2.Volume(scope, 'v', { encrypted: false })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/aws-efs-unencrypted',
    silentIn: [
      {
        path: 'src/aws-efs-unencrypted-corrected.ts',
        source: `import * as efs from 'aws-cdk-lib/aws-efs'
declare const scope: any
new efs.FileSystem(scope, 'f', { encrypted: true })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/aws-efs-unencrypted.ts',
        source: `import * as efs from 'aws-cdk-lib/aws-efs'
declare const scope: any
new efs.FileSystem(scope, 'f', { encrypted: false })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/aws-iam-all-privileges',
    silentIn: [
      {
        path: 'src/aws-iam-all-privileges-corrected.ts',
        source: `import * as iam from 'aws-cdk-lib/aws-iam'
new iam.PolicyStatement({ effect: iam.Effect.ALLOW, actions: ['s3:GetObject'], resources: ['arn:x'] })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/aws-iam-all-privileges.ts',
        source: `import * as iam from 'aws-cdk-lib/aws-iam'
new iam.PolicyStatement({ effect: iam.Effect.ALLOW, actions: ['*'], resources: ['arn:x'] })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/aws-iam-all-resources-accessible',
    silentIn: [
      {
        path: 'src/aws-iam-all-resources-accessible-corrected.ts',
        source: `import * as iam from 'aws-cdk-lib/aws-iam'
new iam.PolicyStatement({ actions: ['s3:GetObject'], resources: ['arn:aws:s3:::reports/*'] })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/aws-iam-all-resources-accessible.ts',
        source: `import * as iam from 'aws-cdk-lib/aws-iam'
new iam.PolicyStatement({ actions: ['s3:GetObject'], resources: ['*'] })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/aws-iam-privilege-escalation',
    silentIn: [
      {
        path: 'src/aws-iam-privilege-escalation-corrected.ts',
        source: `import * as iam from 'aws-cdk-lib/aws-iam'
new iam.PolicyStatement({ actions: ['iam:CreatePolicyVersion'], resources: ['arn:aws:iam::123456789012:policy/app'] })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/aws-iam-privilege-escalation.ts',
        source: `import * as iam from 'aws-cdk-lib/aws-iam'
new iam.PolicyStatement({ actions: ['iam:CreatePolicyVersion'], resources: ['*'] })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/aws-iam-public-access',
    silentIn: [
      {
        path: 'src/aws-iam-public-access-corrected.ts',
        source: `import * as iam from 'aws-cdk-lib/aws-iam'
new iam.PolicyStatement({ principals: [new iam.AccountRootPrincipal()], actions: ['s3:GetObject'], resources: ['arn:x'] })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/aws-iam-public-access.ts',
        source: `import * as iam from 'aws-cdk-lib/aws-iam'
new iam.PolicyStatement({ principals: [new iam.StarPrincipal()], actions: ['s3:GetObject'], resources: ['arn:x'] })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/aws-opensearchservice-domain',
    silentIn: [
      {
        path: 'src/aws-opensearchservice-domain-corrected.ts',
        source: `import * as os from 'aws-cdk-lib/aws-opensearchservice'
declare const scope: any
new os.Domain(scope, 'd', { encryptionAtRest: { enabled: true } })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/aws-opensearchservice-domain.ts',
        source: `import * as os from 'aws-cdk-lib/aws-opensearchservice'
declare const scope: any
new os.Domain(scope, 'd', {})
`,
      },
    ],
  },
  {
    rule: 'sonarjs/aws-rds-unencrypted-databases',
    silentIn: [
      {
        path: 'src/aws-rds-unencrypted-databases-corrected.ts',
        source: `import * as rds from 'aws-cdk-lib/aws-rds'
declare const scope: any
new rds.CfnDBCluster(scope, 'c', { storageEncrypted: true })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/aws-rds-unencrypted-databases.ts',
        source: `import * as rds from 'aws-cdk-lib/aws-rds'
declare const scope: any
new rds.CfnDBCluster(scope, 'c', {})
`,
      },
    ],
  },
  {
    rule: 'sonarjs/aws-restricted-ip-admin-access',
    silentIn: [
      {
        path: 'src/aws-restricted-ip-admin-access-corrected.ts',
        source: `import * as ec2 from 'aws-cdk-lib/aws-ec2'
declare const scope: any
new ec2.CfnSecurityGroupIngress(scope, 'i', { cidrIp: '10.0.0.0/16', ipProtocol: 'tcp', fromPort: 22, toPort: 22 })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/aws-restricted-ip-admin-access.ts',
        source: `import * as ec2 from 'aws-cdk-lib/aws-ec2'
declare const scope: any
new ec2.CfnSecurityGroupIngress(scope, 'i', { cidrIp: '0.0.0.0/0', ipProtocol: 'tcp', fromPort: 22, toPort: 22 })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/aws-s3-bucket-granted-access',
    silentIn: [
      {
        path: 'src/aws-s3-bucket-granted-access-corrected.ts',
        source: `import * as s3 from 'aws-cdk-lib/aws-s3'
declare const scope: any
new s3.Bucket(scope, 'b', { publicReadAccess: false })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/aws-s3-bucket-granted-access.ts',
        source: `import * as s3 from 'aws-cdk-lib/aws-s3'
declare const scope: any
new s3.Bucket(scope, 'b', { publicReadAccess: true })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/aws-s3-bucket-insecure-http',
    silentIn: [
      {
        path: 'src/aws-s3-bucket-insecure-http-corrected.ts',
        source: `import * as s3 from 'aws-cdk-lib/aws-s3'
declare const scope: any
new s3.Bucket(scope, 'b', { versioned: true, enforceSSL: true })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/aws-s3-bucket-insecure-http.ts',
        source: `import * as s3 from 'aws-cdk-lib/aws-s3'
declare const scope: any
new s3.Bucket(scope, 'b', { versioned: true })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/aws-s3-bucket-public-access',
    silentIn: [
      {
        path: 'src/aws-s3-bucket-public-access-corrected.ts',
        source: `import * as s3 from 'aws-cdk-lib/aws-s3'
declare const scope: any
new s3.Bucket(scope, 'b', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/aws-s3-bucket-public-access.ts',
        source: `import * as s3 from 'aws-cdk-lib/aws-s3'
declare const scope: any
new s3.Bucket(scope, 'b', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS_ONLY })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/aws-s3-bucket-versioning',
    silentIn: [
      {
        path: 'src/aws-s3-bucket-versioning-corrected.ts',
        source: `import * as s3 from 'aws-cdk-lib/aws-s3'
declare const scope: any
new s3.Bucket(scope, 'b', { enforceSSL: true, versioned: true })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/aws-s3-bucket-versioning.ts',
        source: `import * as s3 from 'aws-cdk-lib/aws-s3'
declare const scope: any
new s3.Bucket(scope, 'b', { enforceSSL: true })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/aws-sagemaker-unencrypted-notebook',
    silentIn: [
      {
        path: 'src/aws-sagemaker-unencrypted-notebook-corrected.ts',
        source: `import * as sagemaker from 'aws-cdk-lib/aws-sagemaker'
declare const scope: any
declare const notebookKeyId: string
new sagemaker.CfnNotebookInstance(scope, 'n', { kmsKeyId: notebookKeyId })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/aws-sagemaker-unencrypted-notebook.ts',
        source: `import * as sagemaker from 'aws-cdk-lib/aws-sagemaker'
declare const scope: any
new sagemaker.CfnNotebookInstance(scope, 'n', {})
`,
      },
    ],
  },
  {
    rule: 'sonarjs/aws-sns-unencrypted-topics',
    silentIn: [
      {
        path: 'src/aws-sns-unencrypted-topics-corrected.ts',
        source: `import * as sns from 'aws-cdk-lib/aws-sns'
declare const scope: any
declare const topicKey: object
new sns.Topic(scope, 't', { masterKey: topicKey })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/aws-sns-unencrypted-topics.ts',
        source: `import * as sns from 'aws-cdk-lib/aws-sns'
declare const scope: any
new sns.Topic(scope, 't', {})
`,
      },
    ],
  },
  {
    rule: 'sonarjs/aws-sqs-unencrypted-queue',
    silentIn: [
      {
        path: 'src/aws-sqs-unencrypted-queue-corrected.ts',
        source: `import * as sqs from 'aws-cdk-lib/aws-sqs'
declare const scope: any
new sqs.Queue(scope, 'q', { encryption: sqs.QueueEncryption.KMS_MANAGED })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/aws-sqs-unencrypted-queue.ts',
        source: `import * as sqs from 'aws-cdk-lib/aws-sqs'
declare const scope: any
new sqs.Queue(scope, 'q', {})
`,
      },
    ],
  },
  {
    rule: 'sonarjs/bitwise-operators',
    silentIn: [
      {
        path: 'src/bitwise-operators-corrected.ts',
        source: `export function f(a: boolean, b: boolean) { if (a && b) { return 1 } return 2 }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/bitwise-operators.ts',
        source: `export function f(a: boolean, b: boolean) { if (a & b) { return 1 } return 2 }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/bool-param-default',
    silentIn: [
      {
        path: 'src/bool-param-default-corrected.ts',
        source: `function f(flag = false) { return flag }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/bool-param-default.ts',
        source: `function f(flag?: boolean) { return flag }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/chai-determinate-assertion',
    silentIn: [
      {
        path: 'src/chai-determinate-assertion-corrected.ts',
        source: `import { expect } from 'chai'
expect(() => {}).to.not.throw()
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/chai-determinate-assertion.ts',
        source: `import { expect } from 'chai'
expect(() => {}).to.not.throw(TypeError)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/class-prototype',
    silentIn: [
      {
        path: 'src/class-prototype-corrected.ts',
        source: `export class Person {
  greet() {}
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/class-prototype.ts',
        source: `function Person() {}
Person.prototype.greet = function () {}
`,
      },
    ],
  },
  {
    rule: 'sonarjs/cognitive-complexity',
    silentIn: [
      {
        path: 'src/cognitive-complexity-corrected.tsx',
        source: `export function f(a: number, b: number) {
  if (a === b) { return 0 }
  return a > b ? 1 : -1
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/cognitive-complexity.tsx',
        source: `export function f(a: number, b: number, c: number) {
  if (a === 0) { if (b === 0) { for (let j = 0; j < c; j++) { if (j === 0) { return 0 } } } }
  if (a === 1) { if (b === 1) { for (let j = 0; j < c; j++) { if (j === 1) { return 1 } } } }
  if (a === 2) { if (b === 2) { for (let j = 0; j < c; j++) { if (j === 2) { return 2 } } } }
  if (a === 3) { if (b === 3) { for (let j = 0; j < c; j++) { if (j === 3) { return 3 } } } }
  if (a === 4) { if (b === 4) { for (let j = 0; j < c; j++) { if (j === 4) { return 4 } } } }
  if (a === 5) { if (b === 5) { for (let j = 0; j < c; j++) { if (j === 5) { return 5 } } } }
  if (a === 6) { if (b === 6) { for (let j = 0; j < c; j++) { if (j === 6) { return 6 } } } }
  if (a === 7) { if (b === 7) { for (let j = 0; j < c; j++) { if (j === 7) { return 7 } } } }
  return -1
}
`,
      },
    ],
  },
  {
    rule: 'sonarjs/comma-or-logical-or-case',
    silentIn: [
      {
        path: 'src/comma-or-logical-or-case-corrected.ts',
        source: `export function f(n: number) {
  switch (n) {
    case 1:
    case 2:
      break
  }
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/comma-or-logical-or-case.ts',
        source: `export function f(n: number) {
  switch (n) {
    case 1 || 2:
      break
  }
}
`,
      },
    ],
  },
  {
    rule: 'sonarjs/content-length',
    silentIn: [
      {
        path: 'src/content-length-corrected.ts',
        source: `import formidable from 'formidable'
formidable({ maxFileSize: 4000000 })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/content-length.ts',
        source: `import formidable from 'formidable'
formidable({ maxFileSize: 10000000 })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/content-security-policy',
    silentIn: [
      {
        path: 'src/content-security-policy-corrected.ts',
        source: `import express from 'express'
import helmet from 'helmet'
const app = express()
app.use(helmet())
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/content-security-policy.ts',
        source: `import express from 'express'
import helmet from 'helmet'
const app = express()
app.use(helmet({ contentSecurityPolicy: false }))
`,
      },
    ],
  },
  {
    rule: 'sonarjs/cookie-no-httponly',
    silentIn: [
      {
        path: 'src/cookie-no-httponly-corrected.ts',
        source: `import session from 'express-session'
session({ cookie: { httpOnly: true } })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/cookie-no-httponly.ts',
        source: `import session from 'express-session'
session({ cookie: { httpOnly: false } })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/cors',
    silentIn: [
      {
        path: 'src/cors-corrected.ts',
        source: `import cors from 'cors'
import express from 'express'
const app = express()
app.use(cors({ origin: 'https://app.acme-corp.co' }))
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/cors.ts',
        source: `import cors from 'cors'
import express from 'express'
const app = express()
app.use(cors())
`,
      },
    ],
  },
  {
    rule: 'sonarjs/csrf',
    silentIn: [
      {
        path: 'src/csrf-corrected.ts',
        source: `import csurf from 'csurf'
csurf({ cookie: true })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/csrf.ts',
        source: `import csurf from 'csurf'
csurf({ ignoreMethods: ['POST'] })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/different-types-comparison',
    silentIn: [
      {
        path: 'src/different-types-comparison-corrected.ts',
        source: `declare const label: string
declare const count: number
if (label === String(count)) { console.log('same') }
export {}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/different-types-comparison.ts',
        source: `declare const label: string
declare const count: number
if (label === count) { console.log('never') }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/disabled-auto-escaping',
    silentIn: [
      {
        path: 'src/disabled-auto-escaping-corrected.ts',
        source: `import handlebars from 'handlebars'
handlebars.compile('<p>x</p>')
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/disabled-auto-escaping.ts',
        source: `import handlebars from 'handlebars'
handlebars.compile('<p>x</p>', { noEscape: true })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/disabled-resource-integrity',
    silentIn: [
      {
        path: 'src/disabled-resource-integrity-corrected.ts',
        source: `declare const jqueryIntegrity: string
const scriptEl = document.createElement('script')
scriptEl.src = 'https://cdn.example.com/jquery@3.7.1/jquery.min.js'
scriptEl.integrity = jqueryIntegrity
scriptEl.crossOrigin = 'anonymous'
document.head.append(scriptEl)
export {}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/disabled-resource-integrity.ts',
        source: `const scriptEl = document.createElement('script')
scriptEl.src = 'https://cdn.example.com/jquery@3.7.1/jquery.min.js'
document.head.append(scriptEl)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/disabled-timeout',
    silentIn: [
      {
        path: 'src/disabled-timeout-corrected.ts',
        source: `import { expect } from 'chai'
it('x', function () { this.timeout(2000); expect(1).to.equal(1) })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/disabled-timeout.ts',
        source: `import { expect } from 'chai'
it('x', function () { this.timeout(3000000000); expect(1).to.equal(1) })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/dompurify-unsafe-config',
    silentIn: [
      {
        path: 'src/dompurify-unsafe-config-corrected.ts',
        source: `import DOMPurify from 'dompurify'
declare const dirty: string
DOMPurify.sanitize(dirty)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/dompurify-unsafe-config.ts',
        source: `import DOMPurify from 'dompurify'
declare const dirty: string
DOMPurify.sanitize(dirty, { ALLOW_UNKNOWN_PROTOCOLS: true })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/dynamically-constructed-templates',
    silentIn: [
      {
        path: 'src/dynamically-constructed-templates-corrected.ts',
        source: `import ejs from 'ejs'
declare const name: string
ejs.render('<p><%= name %></p>', { name })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/dynamically-constructed-templates.ts',
        source: `import ejs from 'ejs'
declare const name: string
ejs.render(\`<p>\${name}</p>\`)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/elseif-without-else',
    silentIn: [
      {
        path: 'src/elseif-without-else-corrected.ts',
        source: `declare const a: boolean, c: boolean
if (a) { console.log(1) } else if (c) { console.log(2) } else { console.log(3) }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/elseif-without-else.ts',
        source: `declare const a: boolean, c: boolean
if (a) { console.log(1) } else if (c) { console.log(2) }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/empty-string-repetition',
    silentIn: [
      {
        path: 'src/empty-string-repetition-corrected.ts',
        source: `export const r = /(?:a?b)*c/u
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/empty-string-repetition.ts',
        source: `export const r = /(?:a?b?)*c/u
`,
      },
    ],
  },
  {
    rule: 'sonarjs/encryption-secure-mode',
    silentIn: [
      {
        path: 'src/encryption-secure-mode-corrected.ts',
        source: `import crypto from 'crypto'
declare const key: Buffer, iv: Buffer
crypto.createCipheriv('aes-256-gcm', key, iv)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/encryption-secure-mode.ts',
        source: `import crypto from 'crypto'
declare const key: Buffer, iv: Buffer
crypto.createCipheriv('DES-EDE3-CBC', key, iv)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/explicit-test-skip',
    silentIn: [
      {
        path: 'src/explicit-test-skip-corrected.test.ts',
        source: `import { it } from 'vitest'
it('x', (context) => {
  if (process.env.CI) context.skip()
  console.log(1)
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/explicit-test-skip.test.ts',
        source: `import { it } from 'vitest'
it('x', () => {
  if (process.env.CI) return
  console.log(1)
})
`,
      },
    ],
  },
  {
    rule: 'sonarjs/expression-complexity',
    silentIn: [
      {
        path: 'src/expression-complexity-corrected.ts',
        source: `declare const a: boolean
export const x = a && a && a
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/expression-complexity.ts',
        source: `declare const a: boolean
export const x = a && a && a && a && a && a && a
`,
      },
    ],
  },
  {
    rule: 'sonarjs/file-permissions',
    silentIn: [
      {
        path: 'src/file-permissions-corrected.ts',
        source: `import fs from 'fs'
fs.chmodSync('f', 0o750)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/file-permissions.ts',
        source: `import fs from 'fs'
fs.chmodSync('f', 0o777)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/file-uploads',
    silentIn: [
      {
        path: 'src/file-uploads-corrected.ts',
        source: `import formidable from 'formidable'
formidable({ uploadDir: '/srv/uploads', keepExtensions: false })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/file-uploads.ts',
        source: `import formidable from 'formidable'
formidable({ uploadDir: '/tmp', keepExtensions: true })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/future-reserved-words',
    silentIn: [
      {
        path: 'src/future-reserved-words-corrected.ts',
        source: `var publicX = 1
var audience = 2
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/future-reserved-words.ts',
        source: `var publicX = 1
var public = 2
`,
      },
    ],
  },
  {
    rule: 'sonarjs/hardcoded-secret-signatures',
    silentIn: [
      {
        path: 'src/hardcoded-secret-signatures-corrected.ts',
        source: `import jwt from 'jsonwebtoken'
declare const payload: object
declare const signingKey: string
jwt.sign(payload, signingKey)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/hardcoded-secret-signatures.ts',
        source: `import jwt from 'jsonwebtoken'
declare const payload: object
jwt.sign(payload, 'Kj8#mQ2vR7pLx')
`,
      },
    ],
  },
  {
    rule: 'sonarjs/hashing',
    silentIn: [
      {
        path: 'src/hashing-corrected.ts',
        source: `import crypto from 'crypto'
crypto.createHash('sha256')
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/hashing.ts',
        source: `import crypto from 'crypto'
crypto.createHash('sha1')
`,
      },
    ],
  },
  {
    rule: 'sonarjs/in-operator-type-error',
    silentIn: [
      {
        path: 'src/in-operator-type-error-corrected.ts',
        source: `declare const word: { readonly length: number }
if ('length' in word) { console.log('yes') }
export {}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/in-operator-type-error.ts',
        source: `declare const word: string
if ('length' in word) { console.log('yes') }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/inconsistent-function-call',
    silentIn: [
      {
        path: 'src/inconsistent-function-call-corrected.ts',
        source: `function Thing() {}
const a = new Thing();
const b = new Thing();
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/inconsistent-function-call.ts',
        source: `function Thing() {}
const a = new Thing();
const b = Thing();
`,
      },
    ],
  },
  {
    rule: 'sonarjs/index-of-compare-to-positive-number',
    silentIn: [
      {
        path: 'src/index-of-compare-to-positive-number-corrected.ts',
        source: `declare const names: string[]
if (names.includes('bob')) { console.log('found') }
export {}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/index-of-compare-to-positive-number.ts',
        source: `declare const names: string[]
if (names.indexOf('bob') > 0) { console.log('found') }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/insecure-cookie',
    silentIn: [
      {
        path: 'src/insecure-cookie-corrected.ts',
        source: `import session from 'express-session';
session({ cookie: { secure: true } });
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/insecure-cookie.ts',
        source: `import session from 'express-session';
session({ cookie: { secure: false } });
`,
      },
    ],
  },
  {
    rule: 'sonarjs/insecure-jwt-token',
    silentIn: [
      {
        path: 'src/insecure-jwt-token-corrected.ts',
        source: `import jwt from 'jsonwebtoken';
jwt.sign({ a: 1 }, 'key', { algorithm: 'HS256' });
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/insecure-jwt-token.ts',
        source: `import jwt from 'jsonwebtoken';
jwt.sign({ a: 1 }, 'key', { algorithm: 'none' });
`,
      },
    ],
  },
  {
    rule: 'sonarjs/inverted-assertion-arguments',
    silentIn: [
      {
        path: 'src/inverted-assertion-arguments-corrected.test.ts',
        source: `declare const assert: any, actual: number;
it('t', () => { assert.equal(actual, 42); });
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/inverted-assertion-arguments.test.ts',
        source: `declare const assert: any, actual: number;
it('t', () => { assert.equal(42, actual); });
`,
      },
    ],
  },
  {
    rule: 'sonarjs/label-position',
    silentIn: [
      {
        path: 'src/label-position-corrected.ts',
        source: `declare const x: boolean;
if (x) { console.log('x'); }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/label-position.ts',
        source: `declare const x: boolean;
myLabel: if (x) { break myLabel; }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/link-with-target-blank',
    silentIn: [
      {
        path: 'src/link-with-target-blank-corrected.ts',
        source: `declare const window: any;
window.open('https://example.com/page', 'newTab', 'noopener');
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/link-with-target-blank.ts',
        source: `declare const window: any;
window.open('https://example.com/page', 'newTab');
`,
      },
    ],
  },
  {
    rule: 'sonarjs/max-switch-cases',
    silentIn: [
      {
        path: 'src/max-switch-cases-corrected.ts',
        source: `declare const x: number
switch (x) {
  case 1: console.log(1); break;
  case 2: console.log(2); break;
  case 3: console.log(3); break;
  case 4: console.log(4); break;
  case 5: console.log(5); break;
  case 6: console.log(6); break;
  case 7: console.log(7); break;
  case 8: console.log(8); break;
  case 9: console.log(9); break;
  case 10: console.log(10); break;
  case 11: console.log(11); break;
  case 12: console.log(12); break;
  case 13: console.log(13); break;
  case 14: console.log(14); break;
  case 15: console.log(15); break;
  case 16: console.log(16); break;
  case 17: console.log(17); break;
  case 18: console.log(18); break;
  case 19: console.log(19); break;
  case 20: console.log(20); break;
  case 21: console.log(21); break;
  case 22: console.log(22); break;
  case 23: console.log(23); break;
  case 24: console.log(24); break;
  case 25: console.log(25); break;
  case 26: console.log(26); break;
  case 27: console.log(27); break;
  case 28: console.log(28); break;
  case 29: console.log(29); break;
  case 30: console.log(30); break;
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/max-switch-cases.ts',
        source: `declare const x: number;
switch (x) {
  case 1: console.log(1); break;
  case 2: console.log(2); break;
  case 3: console.log(3); break;
  case 4: console.log(4); break;
  case 5: console.log(5); break;
  case 6: console.log(6); break;
  case 7: console.log(7); break;
  case 8: console.log(8); break;
  case 9: console.log(9); break;
  case 10: console.log(10); break;
  case 11: console.log(11); break;
  case 12: console.log(12); break;
  case 13: console.log(13); break;
  case 14: console.log(14); break;
  case 15: console.log(15); break;
  case 16: console.log(16); break;
  case 17: console.log(17); break;
  case 18: console.log(18); break;
  case 19: console.log(19); break;
  case 20: console.log(20); break;
  case 21: console.log(21); break;
  case 22: console.log(22); break;
  case 23: console.log(23); break;
  case 24: console.log(24); break;
  case 25: console.log(25); break;
  case 26: console.log(26); break;
  case 27: console.log(27); break;
  case 28: console.log(28); break;
  case 29: console.log(29); break;
  case 30: console.log(30); break;
  case 31: console.log(31); break;
}
`,
      },
    ],
  },
  {
    rule: 'sonarjs/max-union-size',
    silentIn: [
      {
        path: 'src/max-union-size-corrected.ts',
        source: `let v: 'a' | 'b' | 'c' | 'd' | 'e' | 'f';
v = 'a';
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/max-union-size.ts',
        source: `let v: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
v = 'a';
`,
      },
    ],
  },
  {
    rule: 'sonarjs/memoize-cache-key',
    silentIn: [
      {
        path: 'src/memoize-cache-key-corrected.ts',
        source: `import _ from 'lodash';
const f = _.memoize((a: number, b: number) => a + b, (a: number, b: number) => \`\${a}:\${b}\`);
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/memoize-cache-key.ts',
        source: `import _ from 'lodash';
const f = _.memoize((a: number, b: number) => a + b);
`,
      },
    ],
  },
  {
    rule: 'sonarjs/misplaced-loop-counter',
    silentIn: [
      {
        path: 'src/misplaced-loop-counter-corrected.ts',
        source: `for (let i = 0; i < 10; i++) { console.log(i); }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/misplaced-loop-counter.ts',
        source: `let j = 0;
for (let i = 0; i < 10; j++) { console.log(i); }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/new-operator-misuse',
    silentIn: [
      {
        path: 'src/new-operator-misuse-corrected.ts',
        source: `class Plain { a = 1 }
export const made = new Plain()
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/new-operator-misuse.ts',
        source: `const plain = { a: 1 }
console.log(new plain())
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-all-duplicated-branches',
    silentIn: [
      {
        path: 'src/no-all-duplicated-branches-corrected.ts',
        source: `declare const c: boolean;
if (c) { console.log(1); } else { console.log(2); }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-all-duplicated-branches.ts',
        source: `declare const c: boolean;
if (c) { console.log(1); } else { console.log(1); }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-angular-bypass-sanitization',
    silentIn: [
      {
        path: 'src/no-angular-bypass-sanitization-corrected.ts',
        source: `declare const sanitizer: any, html: string, SecurityContext: any;
sanitizer.sanitize(SecurityContext.HTML, html);
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-angular-bypass-sanitization.ts',
        source: `declare const sanitizer: any, html: string;
sanitizer.bypassSecurityTrustHtml(html);
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-associative-arrays',
    silentIn: [
      {
        path: 'src/no-associative-arrays-corrected.ts',
        source: `const scores: Record<string, number> = {}
scores['alice'] = 1
export { scores }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-associative-arrays.ts',
        source: `const scores: number[] = []
scores['alice'] = 1
console.log(scores)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-async-constructor',
    silentIn: [
      {
        path: 'src/no-async-constructor-corrected.ts',
        source: `export class Loader {
  static async create(): Promise<Loader> {
    await Promise.resolve(1)
    return new Loader()
  }
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-async-constructor.ts',
        source: `class Loader {
  constructor() { void Promise.resolve(1).then(v => v) }
}
console.log(new Loader())
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-case-label-in-switch',
    silentIn: [
      {
        path: 'src/no-case-label-in-switch-corrected.ts',
        source: `declare const x: number;
switch (x) { case 1: while (true) { break; } }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-case-label-in-switch.ts',
        source: `declare const x: number;
switch (x) { case 1: myLabel: while (true) { break myLabel; } }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-clear-text-protocols',
    silentIn: [
      {
        path: 'src/no-clear-text-protocols-corrected.ts',
        source: `export const endpoint = 'https://acme-corp.co/data';
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-clear-text-protocols.ts',
        // eslint-disable-next-line unicorn/prefer-https -- the source is the http URL the rule must report
        source: `export const endpoint = 'http://acme-corp.co/data';
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-code-after-done',
    silentIn: [
      {
        path: 'src/no-code-after-done-corrected.test.ts',
        source: `it('t', (done: any) => { console.log('before'); done(); });
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-code-after-done.test.ts',
        source: `it('t', (done: any) => { done(); console.log('after'); });
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-collapsible-if',
    silentIn: [
      {
        path: 'src/no-collapsible-if-corrected.ts',
        source: `export function f(a: boolean, b: boolean): boolean {
  if (a && b) { return true }
  return false
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-collapsible-if.ts',
        source: `export function f(a: boolean, b: boolean): boolean {
  if (a) { if (b) { return true } }
  return false
}
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-commented-code',
    silentIn: [
      {
        path: 'src/no-commented-code-corrected.ts',
        source: `// Every count starts here.
export const alive = 1;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-commented-code.ts',
        source: `// const dead = compute(1, 2);
export const alive = 1;
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-dead-store',
    silentIn: [
      {
        path: 'src/no-dead-store-corrected.ts',
        source: `declare function compute(): number;
export function f(): number { const x = compute(); return x; }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-dead-store.ts',
        source: `declare function compute(): number;
export function f(): number { let x = compute(); x = 2; return x; }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-debug-commands-in-ui-tests',
    silentIn: [
      {
        path: 'src/no-debug-commands-in-ui-tests-corrected.test.ts',
        source: `declare const cy: any;
it('t', () => { cy.get('button').click(); });
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-debug-commands-in-ui-tests.test.ts',
        source: `declare const cy: any;
it('t', () => { cy.pause(); });
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-element-overwrite',
    silentIn: [
      {
        path: 'src/no-element-overwrite-corrected.ts',
        source: `const arr: number[] = [];
arr[0] = 1;
arr[1] = 2;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-element-overwrite.ts',
        source: `const arr: number[] = [];
arr[0] = 1;
arr[0] = 2;
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-empty-collection',
    silentIn: [
      {
        path: 'src/no-empty-collection-corrected.ts',
        source: `const arr: number[] = [1, 2];
for (const x of arr) { console.log(x); }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-empty-collection.ts',
        source: `const arr: number[] = [];
for (const x of arr) { console.log(x); }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-equals-in-for-termination',
    silentIn: [
      {
        path: 'src/no-equals-in-for-termination-corrected.ts',
        source: `for (let i = 0; i < 10; i++) { console.log(i); }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-equals-in-for-termination.ts',
        source: `for (let i = 0; i != 10; i++) { console.log(i); }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-fixed-wait-in-tests',
    silentIn: [
      {
        path: 'src/no-fixed-wait-in-tests-corrected.test.ts',
        source: `declare const page: any;
it('t', async () => { await page.waitForSelector('#saved'); });
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-fixed-wait-in-tests.test.ts',
        source: `declare const page: any;
it('t', async () => { await page.waitForTimeout(500); });
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-floating-point-equality',
    silentIn: [
      {
        path: 'src/no-floating-point-equality-corrected.ts',
        source: `const ratio = 0.1 + 0.2
if (Math.abs(ratio - 0.3) < Number.EPSILON) { console.log(1) }
export {}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-floating-point-equality.ts',
        source: `const ratio = 0.1 + 0.2
if (ratio === 0.3) { console.log(1) }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-forced-browser-interaction',
    silentIn: [
      {
        path: 'src/no-forced-browser-interaction-corrected.ts',
        source: `import { test } from "@playwright/test"
test("t", async ({ page }) => {
  await page.locator("#a").click()
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-forced-browser-interaction.ts',
        source: `import { test } from "@playwright/test"
test("t", async ({ page }) => {
  await page.locator("#a").click({ force: true })
})
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-global-this',
    silentIn: [
      {
        path: 'src/no-global-this-corrected.ts',
        source: `export const state = { value: 1 }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-global-this.ts',
        source: `this.value = 1
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-hardcoded-ip',
    silentIn: [
      {
        path: 'src/no-hardcoded-ip-corrected.ts',
        source: `const host = process.env.HOST
console.log(host)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-hardcoded-ip.ts',
        source: `const host = "192.168.12.42"
console.log(host)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-hardcoded-passwords',
    silentIn: [
      {
        path: 'src/no-hardcoded-passwords-corrected.ts',
        source: `const password = process.env.PASSWORD
console.log(password)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-hardcoded-passwords.ts',
        source: `const password = "Str0ngLiteralHere"
console.log(password)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-hardcoded-secrets',
    silentIn: [
      {
        path: 'src/no-hardcoded-secrets-corrected.ts',
        source: `const apiKey = process.env.API_KEY
console.log(apiKey)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-hardcoded-secrets.ts',
        // eslint-disable-next-line no-secrets/no-secrets -- the source is the hard-coded secret the rule must report
        source: `const apiKey = "aB3dE7gH2jK9mN4pQ6rS8tU1vW5xY0zJ.+_-"
console.log(apiKey)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-identical-expressions',
    silentIn: [
      {
        path: 'src/no-identical-expressions-corrected.ts',
        source: `declare const count: number
declare const limit: number
if (count < limit) { console.log(1) }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-identical-expressions.ts',
        source: `declare const count: number
if (count < count) { console.log(1) }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-identical-functions',
    silentIn: [
      {
        path: 'src/no-identical-functions-corrected.ts',
        source: `export function a(x: number) {
  const p = x + 1
  const q = p * 2
  const r = q - 3
  return r
}
export function b(x: number) {
  const p = x - 1
  const q = p / 2
  const r = q + 3
  return r
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-identical-functions.ts',
        source: `export function a(x: number) {
  const p = x + 1
  const q = p * 2
  const r = q - 3
  return r
}
export function b(x: number) {
  const p = x + 1
  const q = p * 2
  const r = q - 3
  return r
}
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-ignored-exceptions',
    silentIn: [
      {
        path: 'src/no-ignored-exceptions-corrected.ts',
        source: `declare function go(): void
try { go(); go() } catch (error) { console.error(error) }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-ignored-exceptions.ts',
        source: `declare function go(): void
try { go(); go() } catch (error) {}
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-in-misuse',
    silentIn: [
      {
        path: 'src/no-in-misuse-corrected.ts',
        source: `declare const items: number[]
if (items.includes(2)) { console.log('yes') }
export {}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-in-misuse.ts',
        source: `declare const items: number[]
if ('alice' in items) { console.log('yes') }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-incompatible-assertion-types',
    silentIn: [
      {
        path: 'src/no-incompatible-assertion-types-corrected.ts',
        source: `import assert from 'node:assert'
declare const count: number
declare const label: string
assert.strictEqual(String(count), label)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-incompatible-assertion-types.ts',
        source: `import assert from 'node:assert'
declare const count: number
declare const label: string
assert.strictEqual(count, label)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-incomplete-assertions',
    silentIn: [
      {
        path: 'src/no-incomplete-assertions-corrected.ts',
        source: `declare const actual: unknown
expect(actual).to.equal(1)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-incomplete-assertions.ts',
        source: `declare const actual: unknown
expect(actual).to.be
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-internal-api-use',
    silentIn: [
      {
        path: 'src/no-internal-api-use-corrected.ts',
        source: `import merge from "lodash/merge"
console.log(merge)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-internal-api-use.ts',
        source: `import helper from "lodash/node_modules/lodash.merge"
console.log(helper)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-invariant-returns',
    silentIn: [
      {
        path: 'src/no-invariant-returns-corrected.ts',
        source: `export function f(x: number): number {
  if (x > 1) { return 42 }
  return 0
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-invariant-returns.ts',
        source: `export function f(x: number): number {
  if (x > 1) { return 42 }
  return 42
}
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-literal-call',
    silentIn: [
      {
        path: 'src/no-literal-call-corrected.ts',
        source: `const notAFunction = () => "x"
const result = notAFunction()
console.log(result)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-literal-call.ts',
        source: `const result = "notAFunction"()
console.log(result)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-mime-sniff',
    silentIn: [
      {
        path: 'src/no-mime-sniff-corrected.ts',
        source: `import express from "express"
import helmet from "helmet"
const app = express()
app.use(helmet())
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-mime-sniff.ts',
        source: `import express from "express"
import helmet from "helmet"
const app = express()
app.use(helmet({ noSniff: false }))
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-mixed-completion-style',
    silentIn: [
      {
        path: 'src/no-mixed-completion-style-corrected.ts',
        source: `import { it } from "mocha"
it("works", async () => { await Promise.resolve() })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-mixed-completion-style.ts',
        source: `import { it } from "mocha"
it("works", async (done) => { done() })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-nested-assignment',
    silentIn: [
      {
        path: 'src/no-nested-assignment-corrected.ts',
        source: `let target = 0
target = 5
console.log(target)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-nested-assignment.ts',
        source: `let target = 0
console.log(target = 5)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-nested-conditional',
    silentIn: [
      {
        path: 'src/no-nested-conditional-corrected.ts',
        source: `export function f(a: number) {
  if (!a) { return 'z' }
  return a > 1 ? 'x' : 'y'
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-nested-conditional.ts',
        source: `export function f(a: number) { return a ? (a > 1 ? 'x' : 'y') : 'z' }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-nested-functions',
    silentIn: [
      {
        path: 'src/no-nested-functions-corrected.ts',
        source: `function level1() {
  return function level2() {
    return function level3() {
      return function level4() {
        return function level5() {
          return 1
        }
      }
    }
  }
}
console.log(level1())
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-nested-functions.ts',
        source: `function level1() {
  return function level2() {
    return function level3() {
      return function level4() {
        return function level5() {
          return function level6() {
            return 1
          }
        }
      }
    }
  }
}
console.log(level1())
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-nested-incdec',
    silentIn: [
      {
        path: 'src/no-nested-incdec-corrected.ts',
        source: `let index = 0
index++
const total = index + 1
console.log(total)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-nested-incdec.ts',
        source: `let index = 0
const total = index++ + 1
console.log(total)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-nested-switch',
    silentIn: [
      {
        path: 'src/no-nested-switch-corrected.ts',
        source: `declare const a: number
declare function handle(n: number): void
switch (a) {
  case 1:
    handle(a)
    break
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-nested-switch.ts',
        source: `declare const a: number
switch (a) {
  case 1:
    switch (a) {
      case 2:
        break
    }
    break
}
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-nested-template-literals',
    silentIn: [
      {
        path: 'src/no-nested-template-literals-corrected.ts',
        source: `const name = "x"
const inner = \`inner \${name}\`
const out = \`outer \${inner} end\`
console.log(out)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-nested-template-literals.ts',
        source: `const name = "x"
const out = \`outer \${\`inner \${name}\`} end\`
console.log(out)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-redundant-assignments',
    silentIn: [
      {
        path: 'src/no-redundant-assignments-corrected.ts',
        source: `let level = 1
console.log(level)
level = 2
console.log(level)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-redundant-assignments.ts',
        source: `let level = 1
console.log(level)
level = 1
console.log(level)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-redundant-optional',
    silentIn: [
      {
        path: 'src/no-redundant-optional-corrected.ts',
        source: `interface Config { retries?: number }
export type { Config }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-redundant-optional.ts',
        source: `interface Config { retries?: number | undefined }
export type { Config }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-referrer-policy',
    silentIn: [
      {
        path: 'src/no-referrer-policy-corrected.ts',
        source: `import express from "express"
import helmet from "helmet"
const app = express()
app.use(helmet.referrerPolicy({ policy: "no-referrer" }))
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-referrer-policy.ts',
        source: `import express from "express"
import helmet from "helmet"
const app = express()
app.use(helmet.referrerPolicy({ policy: "unsafe-url" }))
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-same-argument-assert',
    silentIn: [
      {
        path: 'src/no-same-argument-assert-corrected.ts',
        source: `import { expect } from "chai"
declare const value: number
expect(value).to.equal(1)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-same-argument-assert.ts',
        source: `import { expect } from "chai"
declare const value: number
expect(value).to.equal(value)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-same-line-conditional',
    silentIn: [
      {
        path: 'src/no-same-line-conditional-corrected.ts',
        source: `declare const first: boolean
declare const second: boolean
if (first) {
  console.log(1)
}
if (second) { console.log(2) }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-same-line-conditional.ts',
        source: `declare const first: boolean
declare const second: boolean
if (first) {
  console.log(1)
} if (second) { console.log(2) }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-selector-parameter',
    silentIn: [
      {
        path: 'src/no-selector-parameter-corrected.ts',
        source: `declare function doA(): void
declare function doB(): void
export function runA() { doA() }
export function runB() { doB() }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-selector-parameter.ts',
        source: `declare function doA(): void
declare function doB(): void
function run(useA: boolean) {
  if (useA) { doA() } else { doB() }
}
console.log(run)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-session-cookies-on-static-assets',
    silentIn: [
      {
        path: 'src/no-session-cookies-on-static-assets-corrected.ts',
        source: `import express from 'express'
import session from 'express-session'
const app = express()
app.use(express.static('public'))
app.use(session({ secret: 's' }))
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-session-cookies-on-static-assets.ts',
        source: `import express from 'express'
import session from 'express-session'
const app = express()
app.use(session({ secret: 's' }))
app.use(express.static('public'))
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-small-switch',
    silentIn: [
      {
        path: 'src/no-small-switch-corrected.ts',
        source: `export function f(x: number) {
  if (x === 1) { return 'a' }
  return 'b'
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-small-switch.ts',
        source: `export function f(x: number) {
  switch (x) { case 1: return 'a' }
  return 'b'
}
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-sonar-comments',
    silentIn: [
      {
        path: 'src/no-sonar-comments-corrected.ts',
        source: `export const x = 1 // reviewed
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-sonar-comments.ts',
        source: `export const x = 1 // NOSONAR
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-table-as-layout',
    silentIn: [
      {
        path: 'src/no-table-as-layout-corrected.tsx',
        source: `export const T = () => <table><thead><tr><th>Name</th></tr></thead><tbody><tr><td>a</td></tr></tbody></table>
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-table-as-layout.tsx',
        source: `export const T = () => <table role="presentation"><tr><td>a</td></tr></table>
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-trivial-assertions',
    silentIn: [
      {
        path: 'src/no-trivial-assertions-corrected.test.ts',
        source: `import { expect, it } from 'vitest'
it('t', () => { expect(Math.sign(1)).toBe(1) })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-trivial-assertions.test.ts',
        source: `import { expect, it } from 'vitest'
it('t', () => { expect(1).toBe(1) })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-try-promise',
    silentIn: [
      {
        path: 'src/no-try-promise-corrected.ts',
        source: `async function loadThing(): Promise<void> {}
export async function run(): Promise<void> {
  try { await loadThing() } catch { /* swallow */ }
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-try-promise.ts',
        source: `async function loadThing(): Promise<void> {}
try { loadThing(); } catch { /* swallow */ }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-undefined-argument',
    silentIn: [
      {
        path: 'src/no-undefined-argument-corrected.ts',
        source: `function greet(name?: string): string { return name ?? 'x'; }
export const greeting = greet();
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-undefined-argument.ts',
        source: `function greet(name?: string): string { return name ?? 'x'; }
greet(undefined);
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-unenclosed-multiline-block',
    silentIn: [
      {
        path: 'src/no-unenclosed-multiline-block-corrected.js',
        source: `if (globalThis.a) {
  console.log(1);
  console.log(2);
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-unenclosed-multiline-block.js',
        source: `if (globalThis.a)
  console.log(1);
  console.log(2);
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-uniq-key',
    silentIn: [
      {
        path: 'src/no-uniq-key-corrected.tsx',
        source: `export const L = () => <ul>{[{ id: 'a' }, { id: 'b' }].map((item) => <li key={item.id}>{item.id}</li>)}</ul>
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-uniq-key.tsx',
        source: `export const L = () => <ul>{[1, 2].map((i) => <li key={Math.random()}>{i}</li>)}</ul>
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-unused-collection',
    silentIn: [
      {
        path: 'src/no-unused-collection-corrected.ts',
        source: `export function f() { const items = []; items.push(1); return items }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-unused-collection.ts',
        source: `export function f() { const items = []; items.push(1) }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-use-of-empty-return-value',
    silentIn: [
      {
        path: 'src/no-use-of-empty-return-value-corrected.ts',
        source: `function log(m: string) { console.log(m) }
log('a')
export const v = 1
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-use-of-empty-return-value.ts',
        source: `function log(m: string) { console.log(m) }
export const v = log('a')
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-useless-increment',
    silentIn: [
      {
        path: 'src/no-useless-increment-corrected.ts',
        source: `export function f() { let i = 0; i++; return i }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-useless-increment.ts',
        source: `export function f() { let i = 0; i = i++; return i }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-useless-react-setstate',
    silentIn: [
      {
        path: 'src/no-useless-react-setstate-corrected.tsx',
        source: `import { useState } from 'react'
export const C = () => { const [n, setN] = useState(0); return <button onClick={() => setN(n + 1)}>{n}</button> }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-useless-react-setstate.tsx',
        source: `import { useState } from 'react'
export const C = () => { const [n, setN] = useState(0); return <button onClick={() => setN(n)}>{n}</button> }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-weak-cipher',
    silentIn: [
      {
        path: 'src/no-weak-cipher-corrected.ts',
        source: `import crypto from 'node:crypto'
declare const key: Buffer, iv: Buffer
export const c = crypto.createCipheriv('aes-256-gcm', key, iv)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-weak-cipher.ts',
        source: `import crypto from 'node:crypto'
export const c = crypto.createCipheriv('DES-EDE3', 'k', 'iv')
`,
      },
    ],
  },
  {
    rule: 'sonarjs/no-weak-keys',
    silentIn: [
      {
        path: 'src/no-weak-keys-corrected.ts',
        source: `import crypto from 'node:crypto'
export const k = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/no-weak-keys.ts',
        source: `import crypto from 'node:crypto'
export const k = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/non-existent-operator',
    silentIn: [
      {
        path: 'src/non-existent-operator-corrected.js',
        source: `let x = 5;
x -= 3;
console.log(x);
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/non-existent-operator.js',
        source: `let x = 5;
x =- 3;
console.log(x);
`,
      },
    ],
  },
  {
    rule: 'sonarjs/non-number-in-arithmetic-expression',
    silentIn: [
      {
        path: 'src/non-number-in-arithmetic-expression-corrected.ts',
        source: `declare const flag: boolean;
export const scaled = Number(flag) * 2;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/non-number-in-arithmetic-expression.ts',
        source: `declare const flag: boolean;
export const scaled = flag * 2;
`,
      },
    ],
  },
  {
    rule: 'sonarjs/null-dereference',
    silentIn: [
      {
        path: 'src/null-dereference-corrected.ts',
        source: `declare const maybe: string | null;
export const len = maybe === null ? 0 : maybe.length;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/null-dereference.ts',
        source: `const maybe = null;
export const len = maybe.length;
`,
      },
    ],
  },
  {
    rule: 'sonarjs/operation-returning-nan',
    silentIn: [
      {
        path: 'src/operation-returning-nan-corrected.ts',
        source: `declare const bag: { a: number };
export const r = bag.a * 2;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/operation-returning-nan.ts',
        source: `declare const bag: { a: number };
export const r = bag * 2;
`,
      },
    ],
  },
  {
    rule: 'sonarjs/parameterized-tests',
    silentIn: [
      {
        path: 'src/parameterized-tests-corrected.test.ts',
        source: `import { expect, it } from 'vitest'
it.each([1, 2, 3])('signs %d', (n) => { expect(Math.sign(n)).toBe(1) })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/parameterized-tests.test.ts',
        source: `import { expect, it } from 'vitest'
it('a', () => { const r = Math.sign(1); expect(r).toBe(1) })
it('b', () => { const r = Math.sign(2); expect(r).toBe(1) })
it('c', () => { const r = Math.sign(3); expect(r).toBe(1) })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/post-message',
    silentIn: [
      {
        path: 'src/post-message-corrected.ts',
        source: `window.postMessage('hello', 'https://app.acme-corp.co');
export {}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/post-message.ts',
        source: `window.postMessage('hello', '*');
`,
      },
    ],
  },
  {
    rule: 'sonarjs/prefer-immediate-return',
    silentIn: [
      {
        path: 'src/prefer-immediate-return-corrected.ts',
        source: `export function f() { return 1 + 2 }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-immediate-return.ts',
        source: `export function f() { const result = 1 + 2; return result }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/prefer-native-lodash-alternative',
    silentIn: [
      {
        path: 'src/prefer-native-lodash-alternative-corrected.ts',
        source: `export const r = [1, 2].map((x) => x + 1)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-native-lodash-alternative.ts',
        source: `import _ from 'lodash'
export const r = _.map([1, 2], (x) => x + 1)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/prefer-object-literal',
    silentIn: [
      {
        path: 'src/prefer-object-literal-corrected.ts',
        source: `export function f() { const o = { a: 1 }; return o }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-object-literal.ts',
        source: `export function f() { const o = {}; o.a = 1; return o }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/prefer-promise-shorthand',
    silentIn: [
      {
        path: 'src/prefer-promise-shorthand-corrected.ts',
        source: `export const p = Promise.resolve(42)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-promise-shorthand.ts',
        source: `export const p = new Promise((resolve) => resolve(42))
`,
      },
    ],
  },
  {
    rule: 'sonarjs/prefer-type-guard',
    silentIn: [
      {
        path: 'src/prefer-type-guard-corrected.ts',
        source: `function isStr(x: unknown): x is string { return typeof x === 'string' }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-type-guard.ts',
        source: `function isStr(x: unknown): boolean { return (x as string).length !== undefined }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/prefer-while',
    silentIn: [
      {
        path: 'src/prefer-while-corrected.ts',
        source: `let i = 0
while (i < 3) { i++ }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/prefer-while.ts',
        source: `let i = 0
for (; i < 3; ) { i++ }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/production-debug',
    silentIn: [
      {
        path: 'src/production-debug-corrected.ts',
        source: `import errorhandler from 'errorhandler'
import express from 'express'
const app = express()
if (process.env.NODE_ENV === 'development') {
  app.use(errorhandler())
}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/production-debug.ts',
        source: `import errorhandler from 'errorhandler'
import express from 'express'
const app = express()
app.use(errorhandler())
`,
      },
    ],
  },
  {
    rule: 'sonarjs/pseudo-random',
    silentIn: [
      {
        path: 'src/pseudo-random-corrected.ts',
        source: `const n = crypto.getRandomValues(new Uint32Array(1))
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/pseudo-random.ts',
        source: `const n = Math.random()
`,
      },
    ],
  },
  {
    rule: 'sonarjs/public-static-readonly',
    silentIn: [
      {
        path: 'src/public-static-readonly-corrected.ts',
        source: `class Cfg { static readonly limit = 1 }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/public-static-readonly.ts',
        source: `class Cfg { static limit = 1 }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/publicly-writable-directories',
    silentIn: [
      {
        path: 'src/publicly-writable-directories-corrected.ts',
        source: `const p = '/srv/app/out.txt'
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/publicly-writable-directories.ts',
        source: `const p = '/tmp/out.txt'
`,
      },
    ],
  },
  {
    rule: 'sonarjs/reduce-initial-value',
    silentIn: [
      {
        path: 'src/reduce-initial-value-corrected.ts',
        source: `export const total = [1, 2, 3].reduce((a, b) => a + b, 0)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/reduce-initial-value.ts',
        source: `const total = [1, 2, 3].reduce((a, b) => a + b)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/redundant-type-aliases',
    silentIn: [
      {
        path: 'src/redundant-type-aliases-corrected.ts',
        source: `type Name = { first: string; last: string }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/redundant-type-aliases.ts',
        source: `type Name = string
`,
      },
    ],
  },
  {
    rule: 'sonarjs/regex-complexity',
    silentIn: [
      {
        path: 'src/regex-complexity-corrected.ts',
        source: `export const re = /(?:a|b|c|d)/
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/regex-complexity.ts',
        source: `const re = /(?:a|(?:b|(?:c|(?:d|(?:e|(?:f|(?:g|h)))))))/
`,
      },
    ],
  },
  {
    rule: 'sonarjs/review-blockchain-mnemonic',
    silentIn: [
      {
        path: 'src/review-blockchain-mnemonic-corrected.ts',
        source: `import { Wallet } from 'ethers'
declare const phrase: string
const w = Wallet.fromPhrase(phrase)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/review-blockchain-mnemonic.ts',
        source: `import { Wallet } from 'ethers'
const w = Wallet.fromPhrase('test test test test test test test test test test test junk')
`,
      },
    ],
  },
  {
    rule: 'sonarjs/session-regeneration',
    silentIn: [
      {
        path: 'src/session-regeneration-corrected.ts',
        source: `import express from 'express'
import passport from 'passport'
const app = express()
app.post('/login', passport.authenticate('local'), function (req, res) {
  req.session.regenerate(() => { res.redirect('/') })
})
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/session-regeneration.ts',
        source: `import express from 'express'
import passport from 'passport'
const app = express()
app.post('/login', passport.authenticate('local'), function (req, res) { res.redirect('/') })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/sql-queries',
    silentIn: [
      {
        path: 'src/sql-queries-corrected.ts',
        source: `import mysql from 'mysql'
const conn = mysql.createConnection({})
declare const id: string
conn.query('SELECT * FROM t WHERE id = ?', [id])
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/sql-queries.ts',
        source: `import mysql from 'mysql'
const conn = mysql.createConnection({})
declare const id: string
conn.query('SELECT * FROM t WHERE id = ' + id)
`,
      },
    ],
  },
  {
    rule: 'sonarjs/stable-tests',
    silentIn: [
      {
        path: 'src/stable-tests-corrected.test.ts',
        source: `describe('stable', function () { it('passes', () => {}) })
export {}
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/stable-tests.test.ts',
        source: `describe('flaky', function () { this.retries(3) })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/stateful-regex',
    silentIn: [
      {
        path: 'src/stateful-regex-corrected.ts',
        source: `const re2 = /ab/y
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/stateful-regex.ts',
        source: `const re2 = /ab/gy
`,
      },
    ],
  },
  {
    rule: 'sonarjs/strict-transport-security',
    silentIn: [
      {
        path: 'src/strict-transport-security-corrected.ts',
        source: `import express from 'express'
import helmet from 'helmet'
const app = express()
app.use(helmet())
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/strict-transport-security.ts',
        source: `import express from 'express'
import helmet from 'helmet'
const app = express()
app.use(helmet({ hsts: false }))
`,
      },
    ],
  },
  {
    rule: 'sonarjs/table-header',
    silentIn: [
      {
        path: 'src/table-header-corrected.tsx',
        source: `export const T = () => <table><tr><th>x</th></tr><tr><td>1</td></tr></table>
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/table-header.tsx',
        source: `export const T = () => <table><tr><td>x</td></tr></table>
`,
      },
    ],
  },
  {
    rule: 'sonarjs/table-header-reference',
    silentIn: [
      {
        path: 'src/table-header-reference-corrected.tsx',
        source: `export const T2 = () => <table><tr><th id="a">A</th></tr><tr><td headers="a">1</td></tr></table>
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/table-header-reference.tsx',
        source: `export const T2 = () => <table><tr><th id="a">A</th></tr><tr><td headers="zz">1</td></tr></table>
`,
      },
    ],
  },
  {
    rule: 'sonarjs/unverified-certificate',
    silentIn: [
      {
        path: 'src/unverified-certificate-corrected.ts',
        source: `import https from 'https'
https.request({ rejectUnauthorized: true })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/unverified-certificate.ts',
        source: `import https from 'https'
https.request({ rejectUnauthorized: false })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/unverified-hostname',
    silentIn: [
      {
        path: 'src/unverified-hostname-corrected.ts',
        source: `import https from 'https'
https.request({ hostname: 'api.acme-corp.co' })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/unverified-hostname.ts',
        source: `import https from 'https'
https.request({ checkServerIdentity: () => { return true } })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/updated-loop-counter',
    silentIn: [
      {
        path: 'src/updated-loop-counter-corrected.ts',
        source: `for (let j = 0; j < 3; j++) { console.log(j) }
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/updated-loop-counter.ts',
        source: `for (let j = 0; j < 3; j++) { j = 2 }
`,
      },
    ],
  },
  {
    rule: 'sonarjs/use-type-alias',
    silentIn: [
      {
        path: 'src/use-type-alias-corrected.ts',
        source: `type Value = string | number | boolean
let u1: Value
let u2: Value
let u3: Value
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/use-type-alias.ts',
        source: `let u1: string | number | boolean
let u2: string | number | boolean
let u3: string | number | boolean
`,
      },
    ],
  },
  {
    rule: 'sonarjs/values-not-convertible-to-numbers',
    silentIn: [
      {
        path: 'src/values-not-convertible-to-numbers-corrected.ts',
        source: `declare const bag: { a: number };
declare const count: number;
export const bigger = bag.a > count;
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/values-not-convertible-to-numbers.ts',
        source: `declare const bag: { a: number };
declare const count: number;
export const bigger = bag > count;
`,
      },
    ],
  },
  {
    rule: 'sonarjs/variable-name',
    silentIn: [
      {
        path: 'src/variable-name-corrected.ts',
        source: `const myVar = 1
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/variable-name.ts',
        source: `const my_var = 1
`,
      },
    ],
  },
  {
    rule: 'sonarjs/weak-ssl',
    silentIn: [
      {
        path: 'src/weak-ssl-corrected.ts',
        source: `import https from 'https'
https.request({ secureProtocol: 'TLSv1_2_method' })
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/weak-ssl.ts',
        source: `import https from 'https'
https.request({ secureProtocol: 'TLSv1_method' })
`,
      },
    ],
  },
  {
    rule: 'sonarjs/x-powered-by',
    silentIn: [
      {
        path: 'src/x-powered-by-corrected.ts',
        source: `import express from 'express'
const app = express()
app.disable('x-powered-by')
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/x-powered-by.ts',
        source: `import express from 'express'
const app = express()
`,
      },
    ],
  },
  {
    rule: 'sonarjs/xml-parser-xxe',
    silentIn: [
      {
        path: 'src/xml-parser-xxe-corrected.ts',
        source: `import libxmljs from 'libxmljs'
declare const xml: string
libxmljs.parseXml(xml)
`,
      },
    ],
    reportedIn: [
      {
        path: 'src/xml-parser-xxe.ts',
        source: `import libxmljs from 'libxmljs'
declare const xml: string
libxmljs.parseXml(xml, { noent: true })
`,
      },
    ],
  },
]
