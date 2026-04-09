import { createIntegrationTestSuite } from '../../../../tests/utils/create_integration_test_suite'

createIntegrationTestSuite(
  { name: 'users', routePrefix: '/users' },
  {
    when: 'an authenticated user requests the users list',
    then: 'they receive a paginated list of users',
    route: '/get_users_returns_list',
  },
  {
    when: 'an authenticated user creates a new user',
    then: 'the user is created and returned',
    route: '/create_user_succeeds',
  },
)
