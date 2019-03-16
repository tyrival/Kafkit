<template>
	<div id="app">
		<div v-if="showTitle" class="title">Kafkit</div>
		<router-view></router-view>
	</div>
</template>

<script>
  import './assets/styles/app.less'
  import OSUtils from './utils/OSUtils'

  export default {
    name: 'Kafkit',
    computed: {
      showTitle () {
        return OSUtils.getOsInfo().name === 'Mac'
      }
    }
  }
</script>
