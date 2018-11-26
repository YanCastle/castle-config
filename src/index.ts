import DefaultConfig from './config';
import { Context } from 'koa';
export default DefaultConfig;
/**
 * 配置文件结构
 */
export interface CastleContext extends Context {
    config: DefaultConfig;
}