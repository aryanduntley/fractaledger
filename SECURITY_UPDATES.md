# Security Updates

## Version 1.0.5

### Fixed Vulnerabilities

1. **jsrsasign < 11.0.0 (High Severity)**
   - Vulnerability: Marvin Attack of RSA and RSAOAEP decryption in jsrsasign
   - Fix: Added a peer dependency resolution file (`.peerDependencyResolution.json`) to force the use of jsrsasign 11.1.0 when the package is installed as a dependency in another project.

2. **axios < 1.8.2 (High Severity)**
   - Vulnerability: axios Requests Vulnerable To Possible SSRF and Credential Leakage via Absolute URL
   - Fix: Updated axios to version 1.8.4

3. **@babel/helpers < 7.26.10 (Moderate Severity)**
   - Vulnerability: Babel has inefficient RexExp complexity in generated code with .replace when transpiling named capturing groups
   - Fix: Added an override for @babel/helpers to version 7.27.0

4. **@babel/runtime < 7.26.10 (Moderate Severity)**
   - Vulnerability: Babel has inefficient RexExp complexity in generated code with .replace when transpiling named capturing groups
   - Fix: Added an override for @babel/runtime to version 7.27.0

5. **vite 6.2.0 - 6.2.2 (Moderate Severity)**
   - Vulnerability: Vite bypasses server.fs.deny when using ?raw??
   - Fix: Added an override for vite to version 6.2.3

### Implementation Details

The main challenge was fixing the jsrsasign vulnerability, which is a dependency of the Hyperledger Fabric packages (fabric-ca-client, fabric-common, and fabric-network). We've implemented a two-part solution:

1. Updated the Hyperledger Fabric dependencies to their latest versions:
   - fabric-ca-client: 2.2.20 → 2.2.21
   - fabric-common: 2.2.20 → 2.2.21
   - fabric-network: 2.2.20 → 2.5.0

2. Since even the latest versions still have the jsrsasign vulnerability, we've also implemented a solution using npm's peer dependency resolution feature:

1. Created a `.peerDependencyResolution.json` file with the following content:
   ```json
   {
     "jsrsasign": "11.1.0"
   }
   ```

2. Added this file to the "files" array in package.json to ensure it's included in the published package.

3. Updated the package version to 1.0.5 to publish these changes.

When this package is installed as a dependency in another project, npm will use the peer dependency resolution file to resolve the jsrsasign dependency to version 11.1.0, which fixes the vulnerability.

### Other Updates

In addition to fixing the vulnerabilities, we've also updated all other dependencies to their latest versions to ensure the package is using the most up-to-date and secure versions of all dependencies.

### Hyperledger Fabric API Migration

We've migrated from the deprecated Hyperledger Fabric APIs (fabric-ca-client, fabric-common, and fabric-network) to the new Fabric Gateway client API (@hyperledger/fabric-gateway). This migration provides several benefits:

1. **Improved Security**: The new Fabric Gateway client API is more secure and follows modern security best practices.
2. **Better Performance**: The new API is more efficient and provides better performance.
3. **Future-Proof**: The new API is the recommended approach for applications developed for Hyperledger Fabric v2.4 and later.
4. **Simplified Architecture**: The new API has a simpler architecture and is easier to use.

The migration involved:
- Replacing the deprecated APIs with the new Fabric Gateway client API
- Updating the configuration files to match the new API requirements
- Rewriting the fabricManager.js file to use the new API
- Adding the required dependencies (@grpc/grpc-js)
