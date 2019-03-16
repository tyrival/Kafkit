import _ from 'lodash'

const kafka = require('kafka-node')

class Client {
	constructor(config) {
		if (!config) {
			throw new Error('KafkaClient构造参数不可为空。')
		}
		if (!config.hosts || !config.hosts.length) {
			throw new Error('Kafka的主机地址不可为空。')
		}
		this.config = _.merge({
			kafkaHost: '',
			connectTimeout: 10000,
			requestTimeout: 30000,
			autoConnect: true,
			maxAsyncRequests: 10,
			sslOptions: {rejectUnauthorized: false},
			sasl: {mechanism: 'plain', username: 'foo', password: 'bar'}
		}, config)
		for (let i = 0; i < config.hosts.length; i++) {
			this.config.kafkaHost += config.hosts[i] + ','
		}
		this.config.kafkaHost = this.config.kafkaHost.substring(0, this.config.kafkaHost.length - 1)
		this.client = new kafka.KafkaClient(this.config)

		this.initProducer(config.producer)
		this.initHighLevelProducer(config.highLevelProducer)
		this.initConsume([], config.consumer)
	}

	/**
	 * 初始化管理员
	 */
	initAdmin() {
		this.admin = new kafka.Admin(this.client)
	}

	listGroun(callback) {
		this.admin.listGroup(callback)
	}

	listTopics(callback) {
		this.admin.listTopics(callback)
	}

	createTopics(topics, callback) {
		this.admin.createTopics(topics, callback)
	}

	describeConfigs(payloads, callback) {
		this.admin.describeConfigs(payloads, callback)
	}

	describeGroups(consumerGroups, callback) {
		this.admin.describeGroups(consumerGroups, callback)
	}


	/**
	 * 初始化生产者
	 */
	initProducer(producer) {
		this.producer = new kafka.Producer(this.client, _.merge({
			// Configuration for when to consider a message as acknowledged, default 1
			requireAcks: 1,
			// The amount of time in milliseconds to wait for all acks before considered, default 100ms
			ackTimeoutMs: 100,
			// Partitioner type (default = 0, random = 1, cyclic = 2, keyed = 3, custom = 4), default 0
			partitionerType: 2
		}, producer))
		this.producer.on('ready', (message) => {
			this.emitEvent('onProduceReady', message)
		})
		this.producer.on('error', (message) => {
			this.emitEvent('onProduceError', message)
		})
	}

	/**
	 * 初始化高级生产者
	 */
	initHighLevelProducer(highLevelProducer) {
		this.highLevelProducer = new kafka.HighLevelProducer(this.client, _.merge({
			// Configuration for when to consider a message as acknowledged, default 1
			requireAcks: 1,
			// The amount of time in milliseconds to wait for all acks before considered, default 100ms
			ackTimeoutMs: 100
		}, highLevelProducer))
		this.highLevelProducer.on('ready', (message) => {
			this.emitEvent('onHighLevelProduceReady', message)
		})
		this.highLevelProducer.on('error', (message) => {
			this.emitEvent('onHighLevelProduceError', message)
		})
	}

	/**
	 * 初始化消费者
	 * @param payloads, Array of FetchRequest
	 FetchRequest: {
				topic: 'topicName',
				offset: 0, //default 0
				partition: 0 // default 0
		 }
	 * @param options
	 */
	initConsume(payloads, options) {
		let opts = _.merge({
			groupId: 'kafka-node-group',//consumer group id, default `kafka-node-group`
			// Auto commit config
			autoCommit: true,
			autoCommitIntervalMs: 5000,
			// The max wait time is the maximum amount of time in milliseconds to block waiting if insufficient data is available at the time the request is issued, default 100ms
			fetchMaxWaitMs: 100,
			// This is the minimum number of bytes of messages that must be available to give a response, default 1 byte
			fetchMinBytes: 1,
			// The maximum bytes to include in the message set for this partition. This helps bound the size of the response.
			fetchMaxBytes: 1024 * 1024,
			// If set true, consumer will fetch message from the given offset in the payloads
			fromOffset: false,
			// If set to 'buffer', values will be returned as raw buffer objects.
			encoding: 'utf8',
			keyEncoding: 'utf8'
		}, options)
		this.consumer = new kafka.Consumer(this.client, payloads, opts)
		this.consumer.on('message', (message) => {
			this.emitEvent('onConsumerMessage', message)
		})
		this.consumer.on('error', (message) => {
			this.emitEvent('onConsumerError', message)
		})
		this.consumer.on('offsetOutOfRange', (message) => {
			this.emitEvent('onConsumerOffsetOutOfRange', message)
		})
	}

	/**
	 * 创建topics
	 * @param topics，Array of Topics
	 Topic: {
				topic: 'topic2',
				partitions: 5,
				replicationFactor: 3,
				// Optional set of config entries
				configEntries: [
				  {name: 'compression.type', value: 'gzip'},
				  {name: 'min.compaction.lag.ms', value: '50'}
				],
				// Optional explicit partition / replica assignment
				// When this property exists, partitions and replicationFactor properties are ignored
				replicaAssignment: [
				  {partition: 0, replicas: [3, 4]},
				  {partition: 1, replicas: [2, 1]}
				]
	   }
	 * @param callback
	 */
	createTopics(topics, callback) {
		this.client.createTopics(topics, callback)
	}

	createTopicsHighLevel(topics, async, callback) {
		this.highLevelProducer.createTopics(topics, async, callback)
	}

	/**
	 * 发送消息
	 * @param payload: Array ProduceRequest
	 ProduceRequest: {
				topic: 'topicName',
				// multi messages should be a array, single message can be just a string or a KeyedMessage instance
				messages: ['message body'],
				// string or buffer, only needed when using keyed partitioner
				key: 'theKey',
				// default 0
				partition: 0,
				// 0: No compression, 1: Compress using GZip, 2: Compress using snappy, default: 0
				attributes: 2,
				// defaults to Date.now() (only available with kafka v0.10+)
				timestamp: Date.now()
		 }
	 * @param callback
	 */
	send(payloads, callback) {
		this.producer.send(payloads, callback)
	}

	sendHighLevel(payloads, callback) {
		this.highLevelProducer.send(payloads, callback)
	}

	/**
	 * 为消费者增加topics
	 * @param topics
	 * @param callback
	 * @param fromOffset
	 */
	addTopics(topics, callback, fromOffset) {
		this.consumer.addTopics(topics, callback, fromOffset)
	}

	/**
	 * 为消费者移除topics
	 * @param topics
	 * @param callback
	 */
	removeTopics(topics, callback) {
		this.consumer.removeTopics(topics, callback)
	}

	commit(callback) {
		this.consumer.commit(callback)
	}

	pause() {
		this.consumer.pause()
	}

	resume() {
		this.consumer.resume()
	}

	pauseTopics(topics) {
		this.consumer.pauseTopics(topics)
	}

	resumeTopics(topics) {
		this.consumer.resumeTopics(topics)
	}

	close(force, callback) {
		this.consumer.close(force, callback)
	}

	setOffset(topics, partition, offset) {
		this.consumer.setOffset(topics, partition, offset)
	}

	emitEvent(eventName, args) {
		if (!this.config || !this.config.events) {
			return
		}
		let event = this.config.events[eventName]
		if (event && typeof event === 'function') {
			event.apply(this, args)
		}
	}
}

export default Client
