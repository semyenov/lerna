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

    const key = keys[index]
    const values = test[key]
    for (let i = 0; i < values.length; i++) {
      const newCurrent = current.concat(`${key}-${values[i]}`)
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
