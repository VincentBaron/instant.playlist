import { createTestRouter } from '../../../../routes_tests/utils/create_test_router'
import { getUsersReturnsList } from './get_users_returns_list'
import { createUserSucceeds } from './create_user_succeeds'

const router = createTestRouter({
  '/get_users_returns_list': getUsersReturnsList,
  '/create_user_succeeds': createUserSucceeds,
})

export default ['/users', router]
