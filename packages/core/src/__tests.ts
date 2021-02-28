import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { Action, Atom, createStore, F, IActionCreator, IStore } from '.'

let noop: F = () => {}

export function mockFn<I extends any[], O>(
  fn: F<I, O> = (...i: any) => void 0 as any,
) {
  const _fn = Object.assign(
    function(...i: I) {
      // @ts-ignore
      const o = fn.apply(this, i)

      _fn.calls.push({ i, o })

      return o
    },
    {
      calls: Object.assign(new Array<{ i: I; o: O }>(), {
        tail(this: Array<{ i: I; o: O }>) {
          const { length } = this
          if (length === 0) throw new TypeError(`Array is empty`)
          return this[length - 1]
        },
      }),
    },
  )

  return _fn
}

test(`displayName`, () => {
  const setFirstName = Action<string>()
  const setFullName = Action<string>()
  const firstNameAtom = Atom(($, state = 'John') => {
    $(setFirstName, name => (state = name))
    $(setFullName, fullName => (state = fullName.split(' ')[0]))
    return state
  })
  firstNameAtom.displayName = `firstNameAtom`

  const lastNameAtom = Atom(($, state = 'Doe') => {
    $(setFullName, fullName => (state = fullName.split(' ')[1]))
    return state
  })
  lastNameAtom.displayName = `lastNameAtom`
  const isFirstNameShortAtom = Atom($ => $(firstNameAtom).length < 10)
  isFirstNameShortAtom.displayName = `isFirstNameShortAtom`
  const fullNameAtom = Atom($ => `${$(firstNameAtom)} ${$(lastNameAtom)}`)
  fullNameAtom.displayName = `fullNameAtom`
  const displayNameAtom = Atom($ =>
    $(isFirstNameShortAtom) ? $(fullNameAtom) : $(firstNameAtom),
  )
  displayNameAtom.displayName = `displayNameAtom`

  const store = createStore()

  const cb = mockFn()
  store.subscribe(displayNameAtom, cb)

  assert.is(cb.calls.length, 1)
  assert.is(cb.calls.tail().i[0], 'John Doe')

  store.dispatch(setFirstName('John'))
  assert.is(cb.calls.length, 1)
  assert.is(cb.calls.tail().i[0], 'John Doe')

  store.dispatch(setFirstName('Joe'))
  assert.is(cb.calls.length, 2)
  assert.is(cb.calls.tail().i[0], 'Joe Doe')

  store.dispatch(setFirstName('Joooooooooooooooooooe'))
  assert.is(cb.calls.length, 3)
  assert.is(cb.calls.tail().i[0], 'Joooooooooooooooooooe')

  store.dispatch(setFirstName('Joooooooooooooooooooe'))
  assert.is(cb.calls.length, 3)
  assert.is(cb.calls.tail().i[0], 'Joooooooooooooooooooe')

  console.log(`👍`)
})

test(`action mapper`, () => {
  const action = Action((payload: number) => ({ payload: payload + 1 }))
  assert.is(action(1).payload, 2)

  console.log(`👍`)
})

test(`action effect example`, () => {
  function handleEffects(store: IStore) {
    store.subscribe(action => action.effect?.(store))
  }

  const effect = mockFn()
  const doEffect = Action(() => ({ effect }))
  const store = createStore()

  handleEffects(store)

  store.dispatch(doEffect())

  assert.is(effect.calls.length, 1)
  assert.is(effect.calls.tail().i[0], store)

  console.log(`👍`)
})

test(`Atom from`, () => {
  const atom = Atom.from(42)

  assert.is(atom(Action()()).state, 42)
  assert.is(atom(atom.update(s => s + 1)).state, 43)
  assert.is(atom(atom.update(44)).state, 44)

  console.log(`👍`)
})

test(`Store preloaded state`, () => {
  const atom = Atom.from(42)
  const storeWithPreloadedState = createStore({ [atom.displayName]: 0 })
  const storeWithoutPreloadedState = createStore()

  assert.is(storeWithoutPreloadedState.getState(atom), 42)
  assert.is(storeWithPreloadedState.getState(atom), 0)

  storeWithoutPreloadedState.subscribe(atom, noop)
  storeWithPreloadedState.subscribe(atom, noop)

  assert.is(storeWithoutPreloadedState.getState(atom), 42)
  assert.is(storeWithPreloadedState.getState(atom), 0)

  storeWithoutPreloadedState.dispatch(atom.update(s => s + 1))
  storeWithPreloadedState.dispatch(atom.update(s => s + 1))

  assert.is(storeWithoutPreloadedState.getState(atom), 43)
  assert.is(storeWithPreloadedState.getState(atom), 1)

  console.log(`👍`)
})

test(`Batched dispatch`, () => {
  const atom = Atom.from(0)
  const store = createStore()
  const cb = mockFn()

  store.subscribe(atom, cb)

  assert.is(cb.calls.length, 1)

  store.dispatch(
    atom.update(s => s + 1),
    atom.update(s => s + 1),
  )
  assert.is(cb.calls.length, 2)
  assert.is(cb.calls.tail().i[0], 2)

  console.log(`👍`)
})

test(`Batched dispatch dynamic types change`, () => {
  const doSome = Action<any>()
  const addAction = Action<IActionCreator>()
  const actionsCacheAtom = Atom(
    ($, state = new Array<readonly [IActionCreator, any]>()) => {
      $(addAction, actionCreator => (state = [...state, [actionCreator, null]]))

      return state.map(([actionCreator]) => {
        let payload = null
        $(actionCreator, v => (payload = v))
        return [actionCreator, payload] as const
      })
    },
  )
  const store = createStore()

  store.init(actionsCacheAtom)

  store.dispatch(addAction(doSome), doSome(0))

  store.getState(actionsCacheAtom)
  assert.equal(store.getState(actionsCacheAtom), [[doSome, 0]])

  console.log(`👍`)
})
