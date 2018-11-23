import DefaultConfig from '../config';
const DbConfigs = {}
export default class FileConfig extends DefaultConfig {
    async getDbConfig() {
        //基于env和origin路径来判断该用哪个
        return {
            database: 'test',
            username: 'root',
            password: '123456',
            options: {
                host: 'localhost',
                port: 3306,
                dialect: 'mysql',
                timezone: '+8:00',
                pool: { max: 5, min: 1, acquire: 3000, idle: 1000 },
                logging: (await this.getAppDebug()) ? console.log : false
            },
        }
    }
}