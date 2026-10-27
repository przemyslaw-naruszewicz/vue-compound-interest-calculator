// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'
import App from './App.vue'

test('shows the compound interest calculator page heading', () => {
  const wrapper = mount(App)

  expect(wrapper.findAll('h1')).toHaveLength(1)
  expect(wrapper.get('main h1').text()).toBe('Compound Interest Calculator')
})
