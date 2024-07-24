import {
  FetchingJSONSchemaStore,
  InputData,
  JSONSchemaInput,
  type JSONSchemaSourceData,
  type Options,
  type TargetLanguage,
  quicktypeMultiFile,
} from 'quicktype-core'

export async function quicktypeMultipleJSONSchema(
  lang: string | TargetLanguage,
  data: JSONSchemaSourceData[],
  options: Omit<Partial<Options>, 'inputData'>,
) {
  const jsonInput = new JSONSchemaInput(new FetchingJSONSchemaStore())
  await Promise.all(
    data.map(({ name, schema }) =>
      jsonInput.addSource({
        name,
        schema,
      }),
    ),
  )

  const inputData = new InputData()
  inputData.addInput(jsonInput)

  return quicktypeMultiFile({
    lang,
    inputData,
    ...options,
  })
}
