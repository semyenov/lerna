import * as jose from 'jose'

export async function convertBytesToPKCS8(
  keyBytes: Uint8Array,
): Promise<string> {
  // Import the key
  const key = await jose.importPKCS8(keyBytes.toString(), 'ES256K')

  // Export the key to PKCS8 format
  return await jose.exportPKCS8(key)
}

// Example usage
// async function example() {
//   // This is just a placeholder. In reality, you'd have your actual key bytes here.
//   const exampleKeyBytes = new Uint8Array([/* your key bytes */])

//   try {
//     const pkcs8Key = await convertBytesToPKCS8(exampleKeyBytes)
//     console.log(pkcs8Key)
//   }
//   catch (error) {
//     console.error('Error converting key:', error)
//   }
// }

// example()
