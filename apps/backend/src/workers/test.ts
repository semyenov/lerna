import consola from 'consola'

interface TestType {
  [key: string]: string[]
}

function generateCombinations(test: { [key: string]: string[] }): string[][] {
  const keys = Object.keys(test)
  const combinations: string[][] = []

  const generate = (current: string[], index: number): void => {
    if (index === keys.length) {
      combinations.push(current)

      return
    }

    // eslint-disable-next-line security/detect-object-injection
    const key = keys[index]!
    // eslint-disable-next-line security/detect-object-injection
    const values = test[key]

    for (const value of values!) {
      const newCurrent = current.concat(`${key}-${value}`)
      generate(newCurrent, index + 1)
    }
  }

  generate([], 0)

  return combinations
}

const test: TestType = {
  size: ['xs', 's', 'm', 'l', 'xl'],
  color: ['red', 'green', 'blue'],
  material: ['wood', 'plastic', 'metal'],
}

const result = generateCombinations(test)
consola.log(result)
