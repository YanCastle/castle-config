import { env } from 'process'
import { MD5 } from 'castle-crypto'
import * as Sequelize from 'sequelize'
import { resolve, join } from 'path';
import hook from './hook'
import { Context } from 'koa';
import { uuid } from 'castle-utils'
const SequelizeDBs: { [index: string]: Sequelize.Sequelize } = {

}
/**
 * 默认配置文件信息
 */
export default class DefaultConfig {
    protected _ctx: Context;
    constructor(ctx: any, ) {
        this._ctx = ctx;
        hook.emit(ConfigHooks.NEW_CONFIG, ctx, this)
    }
    /**
     * get App Debug Status
     */
    async getAppDebug(): Promise<boolean> {
        return env.NODE_ENV == 'production';
    }

    /**
     * get Static Path ,
     */
    async getStaticPath(): Promise<string> {
        return 'Public';
    }
    /**
     * 获取应用地址
     */
    async getAppPath(): Promise<string> {
        return 'dist';
    }
    /**
     * 获取新的SessionID
     */
    async getNewSessionID() {
        let value = uuid('session')
        this._ctx.cookies.set((await this.getSessionConfig()).Config.key, value)
        return value;
    }
    /**
     * 获取SessionID
     */
    async getSessionID() {
        return this._ctx.cookies.get((await this.getSessionConfig()).Config.key);
    }
    /**
     * 获取session配置信息
     */
    async getSessionConfig(): Promise<{
        Driver: any,
        Config: any
    }> {
        return {
            Driver: 'default',
            Config: {
                key: 'castlekoa',
                path: '.sess',
                maxAge: 86400000,
                overwrite: true, /** (boolean) can overwrite or not (default true) */
                httpOnly: true, /** (boolean) httpOnly or not (default true) */
                signed: true, /** (boolean) signed or not (default true) */
                rolling: false, /** (boolean) Force a session identifier cookie to be set on every response. The expiration is reset to the original maxAge, resetting the expiration countdown. (default is false) */
                renew: false, /** (boolean) renew session when session is nearly expired, so we can always keep user logged in. (default is false)*/
            }
        }
    }
    /**
     * 获取数据库配置
     */
    async getDbConfig() {
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
    /**
     * 获取Sequence数据库实例
     */
    async getSequelizeDb() {
        let config = await this.getDbConfig();
        let hash = MD5.encode(JSON.stringify(config));
        if (!SequelizeDBs[hash]) {
            SequelizeDBs[hash] = new Sequelize(config.database, config.username, config.password, config.options);
        }
        return SequelizeDBs[hash];
    }
    /**
     * 事务标识
     */
    protected _trans: Sequelize.Transaction | undefined;
    /**
     * 事务层数
     */
    protected _transTimes: number = 0;
    /**
     * 开启事务
     */
    async startTrans() {
        this._transTimes++;
        hook.emit(ConfigHooks.START_TRANS, this._ctx, this)
        if (!this._trans) {
            this._trans = await (await this.getSequelizeDb()).transaction()
        }
        return this._trans;
    }
    /**
     * 提交事务
     */
    async commit() {
        this._transTimes--
        hook.emit(ConfigHooks.COMMIT_TRANS, this._ctx, this)
        if (this._trans && this._transTimes == 0) {
            await this._trans.commit()
            this._trans = undefined;
        }
        return true;
    }
    /**
     * 事务撤销
     */
    async rollback() {
        this._transTimes--
        hook.emit(ConfigHooks.ROLLBACK_TRANS, this._ctx, this)
        if (this._trans) {
            await this._trans.rollback()
        }
        return true;
    }
    /**
     * 获取数据库结构定义文件
     * @param TableName 
     */
    async getDbDefine(TableName: string) {
        //加载文件
        try {
            let d = require(resolve(join(await this.getAppPath(), 'db', TableName)))
            return d.default
        } catch (e) {
            throw new Error(`DB_DEFINE_NOT_FOUND:${TableName}`)
        }
    }
    /**
     * 获取数据库的主键
     * @param TableName 
     */
    async getDbPK(TableName: string) {
        let define = await this.getDbDefine(TableName);
        let keys = Object.keys(define);
        for (let i = 0; i < keys.length; i++) {
            if (define[keys[i]].primaryKey) { return keys[i]; }
        }
        throw new Error(`NO_PK:${TableName}`)
    }
    /**
     * 是否允许CORS跨域
     */
    async allowCORS(): Promise<boolean> {
        return true;
    }
    /**
     * 转发配置
     */
    async getProxy(): Promise<{ Host: string, Options: any } | any> {
        return false;
    }
    /**
     * 生成控制器规则
     */
    async getController(): Promise<RouterPath> {
        let path = this._ctx.path.split('/');
        if (path.length > 1) {
            if (path[0] == "" && path.length > 2) { path.shift() }
            return {
                Module: '',
                Controller: path[0],
                Method: path.length == 1 ? 'index' : path[1],
            };
        }
        return new RouterPath
    }

}
export class RouterPath {
    Module: string = '';
    Method: string = "";
    Controller: string = "";
}

export enum ConfigHooks {
    NEW_CONFIG = 'NEW_CONFIG',
    START_TRANS = 'START_TRANS',
    COMMIT_TRANS = 'COMMIT_TRANS',
    ROLLBACK_TRANS = 'ROLLBACK_TRANS',
}